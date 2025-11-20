/**
 * Script de diagnóstico para verificar la sincronización Dolibarr -> E-commerce
 * Verifica que el cronjob de 15 minutos funcione correctamente
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

const db = require('../src/config/database');
const dolibarrService = require('../src/services/dolibarrService');
const pollingService = require('../src/services/pollingService');

async function verificarSincronizacion() {
    console.log('🔍 ============================================');
    console.log('🔍 VERIFICACIÓN DE SINCRONIZACIÓN DOLIBARR');
    console.log('🔍 ============================================\n');

    try {
        // 1. Verificar configuración de Dolibarr
        console.log('1️⃣ Verificando configuración de Dolibarr...');
        const dolibarrEnabled = process.env.DOLIBARR_ENABLED !== 'false';
        const dolibarrUrl = process.env.DOLIBARR_URL;
        const dolibarrUser = process.env.DOLIBARR_API_USER;
        const dolibarrPassword = process.env.DOLIBARR_API_PASSWORD;
        const dolibarrApiKey = process.env.DOLIBARR_API_KEY;

        console.log(`   ✅ Dolibarr habilitado: ${dolibarrEnabled ? 'Sí' : 'No'}`);
        console.log(`   ✅ URL: ${dolibarrUrl || 'NO CONFIGURADA'}`);
        console.log(`   ✅ Usuario: ${dolibarrUser || 'NO CONFIGURADO'}`);
        console.log(`   ✅ API Key: ${dolibarrApiKey ? 'Configurada' : 'No configurada'}`);
        console.log('');

        if (!dolibarrEnabled || !dolibarrUrl) {
            console.log('❌ ERROR: Dolibarr no está configurado correctamente\n');
            return;
        }

        // 2. Verificar conexión con Dolibarr
        console.log('2️⃣ Verificando conexión con Dolibarr...');
        try {
            const connectionTest = await dolibarrService.testConnection();
            if (connectionTest.success) {
                console.log('   ✅ Conexión exitosa con Dolibarr\n');
            } else {
                console.log(`   ❌ Error de conexión: ${connectionTest.error}\n`);
                return;
            }
        } catch (error) {
            console.log(`   ❌ Error de conexión: ${error.message}\n`);
            return;
        }

        // 3. Verificar estado del polling
        console.log('3️⃣ Verificando estado del polling...');
        const pollingEstado = pollingService.getEstado();
        console.log(`   ✅ Polling habilitado: ${pollingEstado.enabled ? 'Sí' : 'No'}`);
        console.log(`   ✅ Intervalo: ${pollingEstado.interval} minutos`);
        console.log(`   ✅ Ejecutándose: ${pollingEstado.isRunning ? 'Sí' : 'No'}`);
        console.log(`   ✅ Última ejecución: ${pollingEstado.lastRun ? pollingEstado.lastRun.toLocaleString() : 'Nunca'}`);
        console.log(`   ✅ Próxima ejecución: ${pollingEstado.nextRun ? pollingEstado.nextRun.toLocaleString() : 'No programada'}`);
        console.log('');

        // 4. Obtener productos de Dolibarr
        console.log('4️⃣ Obteniendo productos de Dolibarr...');
        try {
            const dolibarrProducts = await dolibarrService.getProducts();
            if (dolibarrProducts.success && Array.isArray(dolibarrProducts.data)) {
                console.log(`   ✅ Total de productos en Dolibarr: ${dolibarrProducts.data.length}`);
                
                if (dolibarrProducts.data.length > 0) {
                    console.log('\n   Primeros 5 productos en Dolibarr:');
                    dolibarrProducts.data.slice(0, 5).forEach((product, index) => {
                        console.log(`   ${index + 1}. ${product.label || product.name || 'Sin nombre'} (ID: ${product.id}, Ref: ${product.ref || 'N/A'}, Stock: ${product.stock_reel || product.stock || 0})`);
                    });
                } else {
                    console.log('   ⚠️  No hay productos en Dolibarr');
                }
            } else {
                console.log('   ❌ No se pudieron obtener productos de Dolibarr');
            }
        } catch (error) {
            console.log(`   ❌ Error obteniendo productos: ${error.message}`);
        }
        console.log('');

        // 5. Verificar productos en e-commerce
        console.log('5️⃣ Verificando productos en e-commerce...');
        try {
            const ecommerceProducts = await db.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN dolibarr_id IS NOT NULL THEN 1 END) as con_dolibarr_id,
                    COUNT(CASE WHEN last_sync_source = 'dolibarr' THEN 1 END) as sincronizados_desde_dolibarr
                FROM products
            `);
            
            const stats = ecommerceProducts.rows[0];
            console.log(`   ✅ Total de productos en e-commerce: ${stats.total}`);
            console.log(`   ✅ Productos con dolibarr_id: ${stats.con_dolibarr_id}`);
            console.log(`   ✅ Productos sincronizados desde Dolibarr: ${stats.sincronizados_desde_dolibarr}`);
            console.log('');

            // Mostrar algunos productos sincronizados
            const productosSincronizados = await db.query(`
                SELECT id, name, sku, dolibarr_id, stock, last_sync_source, dolibarr_synced_at
                FROM products
                WHERE dolibarr_id IS NOT NULL
                ORDER BY dolibarr_synced_at DESC
                LIMIT 5
            `);

            if (productosSincronizados.rows.length > 0) {
                console.log('   Últimos 5 productos sincronizados desde Dolibarr:');
                productosSincronizados.rows.forEach((product, index) => {
                    const syncedAt = product.dolibarr_synced_at 
                        ? new Date(product.dolibarr_synced_at).toLocaleString() 
                        : 'N/A';
                    console.log(`   ${index + 1}. ${product.name} (SKU: ${product.sku}, Dolibarr ID: ${product.dolibarr_id}, Stock: ${product.stock}, Sincronizado: ${syncedAt})`);
                });
            }
        } catch (error) {
            console.log(`   ❌ Error verificando productos: ${error.message}`);
        }
        console.log('');

        // 6. Probar sincronización manual de un producto
        console.log('6️⃣ Probando sincronización manual...');
        try {
            const dolibarrProducts = await dolibarrService.getProducts();
            if (dolibarrProducts.success && dolibarrProducts.data.length > 0) {
                const testProduct = dolibarrProducts.data[0];
                console.log(`   Probando con producto: ${testProduct.label || testProduct.name} (ID: ${testProduct.id}, Ref: ${testProduct.ref || 'N/A'})`);
                
                const syncResult = await dolibarrService.syncProductFromDolibarr(testProduct, db);
                console.log(`   ✅ Sincronización exitosa: ${syncResult.action} (Product ID: ${syncResult.product_id})`);
            } else {
                console.log('   ⚠️  No hay productos en Dolibarr para probar');
            }
        } catch (error) {
            console.log(`   ❌ Error en sincronización manual: ${error.message}`);
            if (error.stack) {
                console.log(`   Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
            }
        }
        console.log('');

        // 7. Verificar logs de integración recientes
        console.log('7️⃣ Verificando logs de integración recientes...');
        try {
            const logs = await db.query(`
                SELECT 
                    source,
                    direction,
                    action,
                    status,
                    reference,
                    created_at
                FROM integration_logs
                WHERE source = 'dolibarr' AND direction = 'inbound'
                ORDER BY created_at DESC
                LIMIT 10
            `);

            if (logs.rows.length > 0) {
                console.log(`   ✅ Últimos ${logs.rows.length} eventos de sincronización:`);
                logs.rows.forEach((log, index) => {
                    const createdAt = new Date(log.created_at).toLocaleString();
                    const statusIcon = log.status === 'success' ? '✅' : log.status === 'error' ? '❌' : '⚠️';
                    console.log(`   ${index + 1}. ${statusIcon} ${log.action} - ${log.reference || 'N/A'} (${log.status}) - ${createdAt}`);
                });
            } else {
                console.log('   ⚠️  No hay logs de sincronización recientes');
            }
        } catch (error) {
            console.log(`   ⚠️  Error obteniendo logs (tabla puede no existir): ${error.message}`);
        }
        console.log('');

        // 8. Resumen y recomendaciones
        console.log('📊 ============================================');
        console.log('📊 RESUMEN Y RECOMENDACIONES');
        console.log('📊 ============================================\n');

        if (pollingEstado.enabled) {
            console.log('✅ El polling está habilitado y debería ejecutarse automáticamente cada 15 minutos');
            console.log('✅ Para probar la sincronización:');
            console.log('   1. Crea un producto nuevo en Dolibarr');
            console.log('   2. Espera máximo 15 minutos (o ejecuta manualmente el polling)');
            console.log('   3. Verifica que el producto aparezca en el e-commerce');
        } else {
            console.log('⚠️  El polling está deshabilitado');
            console.log('   Para habilitarlo, asegúrate de que DOLIBARR_POLLING_ENABLED no esté en "false"');
        }

        console.log('\n✅ Verificación completada\n');

    } catch (error) {
        console.error('❌ Error en la verificación:', error);
        if (error.stack) {
            console.error('Stack:', error.stack);
        }
    } finally {
        await db.close();
    }
}

// Ejecutar verificación
if (require.main === module) {
    verificarSincronizacion()
        .then(() => {
            console.log('✅ Script finalizado');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { verificarSincronizacion };

