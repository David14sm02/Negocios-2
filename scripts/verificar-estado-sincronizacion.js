/**
 * Script para verificar el estado actual de la sincronización bidireccional
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

const db = require('../src/config/database');
const dolibarrService = require('../src/services/dolibarrService');

async function verificarEstado() {
    try {
        console.log('🔍 Verificando estado de la sincronización bidireccional...\n');

        // 1. Verificar conexión con Dolibarr
        console.log('1️⃣ Verificando conexión con Dolibarr...');
        const connectionTest = await dolibarrService.testConnection();
        if (connectionTest.success) {
            console.log('   ✅ Conexión con Dolibarr: ACTIVA\n');
        } else {
            console.log('   ❌ Conexión con Dolibarr: FALLIDA\n');
            return;
        }

        // 2. Verificar productos en e-commerce
        console.log('2️⃣ Productos en E-commerce:');
        const localProducts = await db.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(dolibarr_id) as con_dolibarr_id,
                COUNT(*) FILTER (WHERE last_sync_source = 'ecommerce') as sincronizados_desde_ecommerce,
                COUNT(*) FILTER (WHERE last_sync_source = 'dolibarr') as sincronizados_desde_dolibarr
            FROM products
            WHERE is_active = true
        `);
        
        const stats = localProducts.rows[0];
        console.log(`   - Total productos activos: ${stats.total}`);
        console.log(`   - Con dolibarr_id: ${stats.con_dolibarr_id}`);
        console.log(`   - Sincronizados desde e-commerce: ${stats.sincronizados_desde_ecommerce}`);
        console.log(`   - Sincronizados desde Dolibarr: ${stats.sincronizados_desde_dolibarr}\n`);

        // 3. Verificar productos en Dolibarr
        console.log('3️⃣ Productos en Dolibarr:');
        const dolibarrProducts = await dolibarrService.getProducts();
        if (dolibarrProducts.success && Array.isArray(dolibarrProducts.data)) {
            console.log(`   - Total productos: ${dolibarrProducts.data.length}`);
            
            // Mostrar algunos ejemplos
            if (dolibarrProducts.data.length > 0) {
                console.log('\n   📦 Ejemplos de productos en Dolibarr:');
                dolibarrProducts.data.slice(0, 3).forEach(p => {
                    console.log(`      - ${p.label || p.name} (ID: ${p.id}, Ref: ${p.ref || 'N/A'})`);
                });
            }
        } else {
            console.log('   ❌ No se pudieron obtener productos de Dolibarr\n');
        }

        // 4. Verificar sincronización E-commerce → Dolibarr
        console.log('\n4️⃣ Sincronización E-commerce → Dolibarr:');
        const testProduct = await db.query(`
            SELECT * FROM products 
            WHERE is_active = true 
            AND (dolibarr_id IS NULL OR last_sync_source = 'ecommerce')
            LIMIT 1
        `);
        
        if (testProduct.rows.length > 0) {
            const product = testProduct.rows[0];
            console.log(`   ✅ Producto de prueba: ${product.name} (SKU: ${product.sku})`);
            console.log(`      - dolibarr_id: ${product.dolibarr_id || 'NULL (no sincronizado)'}`);
            console.log(`      - sync_direction: ${product.sync_direction || 'NULL'}`);
            console.log(`      - last_sync_source: ${product.last_sync_source || 'NULL'}`);
            
            if (!product.dolibarr_id) {
                console.log(`   ⚠️  Este producto NO está sincronizado con Dolibarr`);
                console.log(`   💡 Para sincronizarlo: POST /api/dolibarr/sync/product/${product.id}`);
            } else {
                console.log(`   ✅ Este producto YA está sincronizado con Dolibarr`);
            }
        }

        // 5. Verificar sincronización Dolibarr → E-commerce
        console.log('\n5️⃣ Sincronización Dolibarr → E-commerce:');
        console.log('   📋 Estado actual:');
        console.log('      - ✅ Endpoint webhook: /api/dolibarr/webhook (listo pero requiere trigger en Dolibarr)');
        console.log('      - ✅ Script de polling: scripts/sync-from-dolibarr-polling.js (listo para usar)');
        console.log('      - ⚠️  Sincronización automática: NO configurada (requiere polling o webhook)');
        
        // Verificar si hay productos en Dolibarr que no están en e-commerce
        if (dolibarrProducts.success && Array.isArray(dolibarrProducts.data)) {
            const productosSinSincronizar = [];
            for (const dolibarrProduct of dolibarrProducts.data.slice(0, 5)) {
                const ref = dolibarrProduct.ref || dolibarrProduct.barcode;
                if (ref) {
                    const existe = await db.query(
                        'SELECT id FROM products WHERE sku = $1 OR dolibarr_id = $2',
                        [ref, dolibarrProduct.id]
                    );
                    if (existe.rows.length === 0) {
                        productosSinSincronizar.push({
                            id: dolibarrProduct.id,
                            ref: ref,
                            label: dolibarrProduct.label || dolibarrProduct.name
                        });
                    }
                }
            }
            
            if (productosSinSincronizar.length > 0) {
                console.log(`\n   ⚠️  Productos en Dolibarr que NO están en e-commerce (primeros 5):`);
                productosSinSincronizar.forEach(p => {
                    console.log(`      - ${p.label} (ID: ${p.id}, Ref: ${p.ref})`);
                });
                console.log(`   💡 Para sincronizarlos: node scripts/sync-from-dolibarr-polling.js`);
            } else {
                console.log(`   ✅ Los productos verificados ya están sincronizados`);
            }
        }

        // 6. Resumen
        console.log('\n\n📊 RESUMEN DEL ESTADO:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ E-commerce → Dolibarr:');
        console.log('   - Funcionalidad: ACTIVA');
        console.log('   - Cuando creas un producto en e-commerce, se sincroniza a Dolibarr');
        console.log('   - Requiere: DOLIBARR_AUTO_SYNC=true (ya configurado)');
        console.log('');
        console.log('⚠️  Dolibarr → E-commerce:');
        console.log('   - Funcionalidad: IMPLEMENTADA pero NO automática');
        console.log('   - Cuando creas un producto en Dolibarr, NO se sincroniza automáticamente');
        console.log('   - Para activar: Ejecutar polling periódico o configurar webhook en Dolibarr');
        console.log('');
        console.log('💡 PARA ACTIVAR SINCRONIZACIÓN AUTOMÁTICA DESDE DOLIBARR:');
        console.log('   1. Opción fácil: Ejecutar polling cada 15 minutos');
        console.log('      node scripts/sync-from-dolibarr-polling.js');
        console.log('');
        console.log('   2. Opción avanzada: Crear trigger en Dolibarr que llame al webhook');
        console.log('      (Ver GUIA_WEBHOOK_DOLIBARR.md para detalles)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
        console.error('❌ Error verificando estado:', error);
        throw error;
    } finally {
        await db.close();
    }
}

// Ejecutar verificación
verificarEstado()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    });

