/**
 * Diagnóstico: ¿Por qué no se sincroniza desde e-commerce a Dolibarr?
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

const db = require('../src/config/database');
const dolibarrService = require('../src/services/dolibarrService');

async function diagnosticar() {
    try {
        console.log('🔍 DIAGNÓSTICO: Sincronización E-commerce → Dolibarr\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // 1. Verificar configuración
        console.log('1️⃣ Verificando configuración...');
        const dolibarrUrl = process.env.DOLIBARR_URL;
        const autoSync = process.env.DOLIBARR_AUTO_SYNC;
        const enabled = process.env.DOLIBARR_ENABLED;
        
        console.log(`   - DOLIBARR_ENABLED: ${enabled}`);
        console.log(`   - DOLIBARR_URL: ${dolibarrUrl ? '✅ Configurado' : '❌ NO configurado'}`);
        console.log(`   - DOLIBARR_AUTO_SYNC: ${autoSync}`);
        
        if (!dolibarrUrl) {
            console.log('\n   ❌ PROBLEMA: DOLIBARR_URL no está configurada\n');
            return;
        }
        
        if (autoSync === 'false') {
            console.log('\n   ❌ PROBLEMA: DOLIBARR_AUTO_SYNC está en false\n');
            return;
        }
        
        console.log('   ✅ Configuración correcta\n');

        // 2. Verificar conexión con Dolibarr
        console.log('2️⃣ Verificando conexión con Dolibarr...');
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

        // 3. Buscar productos sin sincronizar
        console.log('3️⃣ Buscando productos sin sincronizar...');
        const productosSinSincronizar = await db.query(`
            SELECT id, name, sku, dolibarr_id, last_sync_source, created_at
            FROM products
            WHERE dolibarr_id IS NULL
               OR (last_sync_source = 'ecommerce' AND dolibarr_id IS NULL)
            ORDER BY created_at DESC
            LIMIT 5
        `);

        if (productosSinSincronizar.rows.length > 0) {
            console.log(`   ⚠️  Se encontraron ${productosSinSincronizar.rows.length} productos sin sincronizar:\n`);
            productosSinSincronizar.rows.forEach(p => {
                console.log(`      - ${p.name} (SKU: ${p.sku}, ID: ${p.id})`);
                console.log(`        Creado: ${new Date(p.created_at).toLocaleString()}`);
                console.log(`        dolibarr_id: ${p.dolibarr_id || 'NULL'}`);
                console.log(`        last_sync_source: ${p.last_sync_source || 'NULL'}\n`);
            });
        } else {
            console.log('   ✅ Todos los productos están sincronizados\n');
        }

        // 4. Verificar logs de errores recientes
        console.log('4️⃣ Verificando logs de errores recientes...');
        const errores = await db.query(`
            SELECT direction, action, status, reference, error_message, created_at
            FROM integration_logs
            WHERE source = 'dolibarr' 
              AND direction = 'outbound'
              AND status = 'error'
              AND created_at > NOW() - INTERVAL '1 hour'
            ORDER BY created_at DESC
            LIMIT 5
        `);

        if (errores.rows.length > 0) {
            console.log(`   ⚠️  Se encontraron ${errores.rows.length} errores recientes:\n`);
            errores.rows.forEach(e => {
                console.log(`      - ${e.action} | ${e.reference || 'N/A'}`);
                console.log(`        Error: ${e.error_message}`);
                console.log(`        Fecha: ${new Date(e.created_at).toLocaleString()}\n`);
            });
        } else {
            console.log('   ✅ No se encontraron errores recientes\n');
        }

        // 5. Probar sincronización manual de un producto
        if (productosSinSincronizar.rows.length > 0) {
            console.log('5️⃣ Probando sincronización manual...');
            const productoPrueba = productosSinSincronizar.rows[0];
            
            try {
                console.log(`   Intentando sincronizar: ${productoPrueba.name} (SKU: ${productoPrueba.sku})...`);
                const syncResult = await dolibarrService.syncProduct(productoPrueba, db);
                
                if (syncResult.success && syncResult.dolibarr_id) {
                    console.log(`   ✅ Sincronización exitosa!`);
                    console.log(`      - Dolibarr ID: ${syncResult.dolibarr_id}`);
                    
                    // Verificar que se actualizó en BD
                    const verificar = await db.query(
                        'SELECT dolibarr_id, last_sync_source FROM products WHERE id = $1',
                        [productoPrueba.id]
                    );
                    if (verificar.rows.length > 0) {
                        const p = verificar.rows[0];
                        console.log(`      - dolibarr_id en BD: ${p.dolibarr_id}`);
                        console.log(`      - last_sync_source: ${p.last_sync_source}`);
                    }
                } else {
                    console.log(`   ⚠️  Sincronización no completada: ${JSON.stringify(syncResult)}`);
                }
            } catch (error) {
                console.log(`   ❌ Error en sincronización manual: ${error.message}`);
                console.log(`   Stack: ${error.stack}`);
            }
            console.log('');
        }

        // 6. Resumen y recomendaciones
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 RESUMEN:\n');
        
        if (productosSinSincronizar.rows.length > 0) {
            console.log('❌ PROBLEMA IDENTIFICADO:');
            console.log('   Hay productos que NO se sincronizaron automáticamente\n');
            console.log('💡 POSIBLES CAUSAS:');
            console.log('   1. Error silencioso durante la creación (revisa logs del servidor)');
            console.log('   2. DOLIBARR_AUTO_SYNC no está activo');
            console.log('   3. Error de conexión con Dolibarr en el momento de creación');
            console.log('   4. El servidor no está corriendo o se reinició\n');
            console.log('🔧 SOLUCIONES:');
            console.log('   1. Revisar logs del servidor cuando creas un producto');
            console.log('   2. Verificar que DOLIBARR_AUTO_SYNC=true en config.env');
            console.log('   3. Sincronizar manualmente: POST /api/dolibarr/sync/product/:id');
            console.log('   4. O ejecutar: node scripts/sync-all-products-to-dolibarr.js\n');
        } else {
            console.log('✅ Todo parece estar funcionando correctamente');
            console.log('   Si creas un producto nuevo, debería sincronizarse inmediatamente\n');
        }

    } catch (error) {
        console.error('❌ Error en diagnóstico:', error);
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

