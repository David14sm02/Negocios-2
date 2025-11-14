/**
 * Diagnóstico completo: ¿Por qué test11 no aparece en el e-commerce?
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

const db = require('../src/config/database');
const dolibarrService = require('../src/services/dolibarrService');

async function diagnosticar() {
    try {
        console.log('🔍 DIAGNÓSTICO: Producto test11 desde Dolibarr\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // 1. Verificar conexión con Dolibarr
        console.log('1️⃣ Verificando conexión con Dolibarr...');
        try {
            const connectionTest = await dolibarrService.testConnection();
            if (connectionTest.success) {
                console.log('   ✅ Conexión con Dolibarr: OK\n');
            } else {
                console.log('   ❌ Conexión con Dolibarr: FALLIDA\n');
                return;
            }
        } catch (error) {
            console.log(`   ❌ Error de conexión: ${error.message}\n`);
            return;
        }

        // 2. Buscar test11 en Dolibarr
        console.log('2️⃣ Buscando producto "test11" en Dolibarr...');
        try {
            const dolibarrProducts = await dolibarrService.getProducts();
            
            if (!dolibarrProducts.success || !Array.isArray(dolibarrProducts.data)) {
                console.log('   ❌ No se pudieron obtener productos de Dolibarr\n');
                return;
            }

            const test11 = dolibarrProducts.data.find(
                p => (p.ref === 'test11' || p.ref === 'TEST11' || 
                      p.label === 'test11' || p.label === 'test' ||
                      p.id === 12) // ID visible en la imagen
            );

            if (test11) {
                console.log('   ✅ Producto encontrado en Dolibarr:');
                console.log(`      - ID: ${test11.id}`);
                console.log(`      - Ref: ${test11.ref || 'N/A'}`);
                console.log(`      - Label: ${test11.label || test11.name || 'N/A'}`);
                console.log(`      - Precio: ${test11.price || 'N/A'}`);
                console.log(`      - Stock: ${test11.stock_reel || test11.stock || 'N/A'}\n`);
            } else {
                console.log('   ⚠️  Producto "test11" NO encontrado en Dolibarr');
                console.log('   📋 Productos disponibles en Dolibarr:');
                dolibarrProducts.data.slice(0, 5).forEach(p => {
                    console.log(`      - ${p.label || p.name} (ID: ${p.id}, Ref: ${p.ref || 'N/A'})`);
                });
                console.log('');
                return;
            }

            // 3. Buscar test11 en e-commerce
            console.log('3️⃣ Buscando producto "test11" en e-commerce...');
            const localProduct = await db.query(`
                SELECT * FROM products 
                WHERE sku = $1 OR dolibarr_id = $2 OR name ILIKE $3
            `, ['test11', test11.id, '%test11%']);

            if (localProduct.rows.length > 0) {
                const product = localProduct.rows[0];
                console.log('   ✅ Producto encontrado en e-commerce:');
                console.log(`      - ID: ${product.id}`);
                console.log(`      - SKU: ${product.sku}`);
                console.log(`      - Nombre: ${product.name}`);
                console.log(`      - dolibarr_id: ${product.dolibarr_id || 'NULL'}`);
                console.log(`      - Stock: ${product.stock}`);
                console.log(`      - last_sync_source: ${product.last_sync_source || 'NULL'}`);
                console.log(`      - dolibarr_synced_at: ${product.dolibarr_synced_at || 'NULL'}\n`);
            } else {
                console.log('   ❌ Producto NO encontrado en e-commerce\n');
            }

            // 4. Verificar configuración de polling
            console.log('4️⃣ Verificando configuración de polling...');
            const pollingEnabled = process.env.DOLIBARR_POLLING_ENABLED !== 'false';
            const pollingInterval = process.env.DOLIBARR_POLLING_INTERVAL || 15;
            
            console.log(`   - DOLIBARR_POLLING_ENABLED: ${pollingEnabled ? '✅ true' : '❌ false'}`);
            console.log(`   - DOLIBARR_POLLING_INTERVAL: ${pollingInterval} minutos`);
            console.log(`   - DOLIBARR_POLLING_RUN_ON_START: ${process.env.DOLIBARR_POLLING_RUN_ON_START !== 'false' ? '✅ true' : '❌ false'}\n`);

            // 5. Verificar logs recientes
            console.log('5️⃣ Verificando logs de sincronización recientes...');
            const recentLogs = await db.query(`
                SELECT direction, action, status, reference, created_at
                FROM integration_logs
                WHERE source = 'dolibarr' 
                  AND direction = 'inbound'
                  AND created_at > NOW() - INTERVAL '1 hour'
                ORDER BY created_at DESC
                LIMIT 5
            `);

            if (recentLogs.rows.length > 0) {
                console.log(`   ✅ Se encontraron ${recentLogs.rows.length} sincronizaciones recientes:`);
                recentLogs.rows.forEach(log => {
                    console.log(`      - ${log.action} | ${log.status} | ${log.reference || 'N/A'} | ${new Date(log.created_at).toLocaleString()}`);
                });
            } else {
                console.log('   ⚠️  NO se encontraron sincronizaciones recientes desde Dolibarr');
                console.log('   💡 Esto significa que el polling NO se ha ejecutado o NO está funcionando\n');
            }

            // 6. Intentar sincronizar test11 manualmente
            console.log('6️⃣ Intentando sincronizar test11 manualmente...');
            try {
                const syncResult = await dolibarrService.syncProductFromDolibarr(test11, db);
                console.log(`   ✅ Sincronización exitosa: ${syncResult.action}`);
                console.log(`      - Product ID: ${syncResult.product_id}`);
                console.log(`      - Dolibarr ID: ${syncResult.dolibarr_id}\n`);

                // Verificar que ahora existe
                const verificar = await db.query(
                    'SELECT id, name, sku, dolibarr_id, stock FROM products WHERE id = $1',
                    [syncResult.product_id]
                );
                if (verificar.rows.length > 0) {
                    const p = verificar.rows[0];
                    console.log('   ✅ Producto ahora en e-commerce:');
                    console.log(`      - ID: ${p.id}`);
                    console.log(`      - Nombre: ${p.name}`);
                    console.log(`      - SKU: ${p.sku}`);
                    console.log(`      - Stock: ${p.stock}`);
                    console.log(`      - dolibarr_id: ${p.dolibarr_id}\n`);
                }
            } catch (error) {
                console.log(`   ❌ Error sincronizando: ${error.message}\n`);
            }

            // 7. Resumen y recomendaciones
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📊 RESUMEN Y RECOMENDACIONES:\n');
            
            if (localProduct.rows.length === 0) {
                console.log('❌ PROBLEMA IDENTIFICADO:');
                console.log('   El producto test11 existe en Dolibarr pero NO en el e-commerce\n');
                console.log('💡 SOLUCIONES:');
                console.log('   1. ✅ Sincronización manual ejecutada arriba (debería funcionar ahora)');
                console.log('   2. ⚠️  El polling automático NO se ha ejecutado aún');
                console.log('   3. 🔧 Verificar que el servidor esté corriendo con polling activo\n');
                console.log('🚀 PARA ACTIVAR POLLING AUTOMÁTICO:');
                console.log('   1. Reiniciar el servidor: npm start');
                console.log('   2. Verificar en los logs que aparezca:');
                console.log('      "✅ [POLLING] Polling automático configurado"');
                console.log('   3. Esperar máximo 15 minutos para la primera sincronización');
                console.log('   4. O ejecutar manualmente: node scripts/sync-from-dolibarr-polling.js\n');
            } else {
                console.log('✅ El producto YA está en el e-commerce');
                console.log('   Verifica en: http://localhost:3000/catalog.html\n');
            }

        } catch (error) {
            console.error('❌ Error en diagnóstico:', error);
            throw error;
        }

    } catch (error) {
        console.error('❌ Error fatal:', error);
        throw error;
    } finally {
        await db.close();
    }
}

// Ejecutar diagnóstico
diagnosticar()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    });

