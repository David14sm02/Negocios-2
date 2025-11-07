/**
 * Script para sincronizar todos los productos del e-commerce a Dolibarr
 * Ejecuta: node scripts/sync-all-products-to-dolibarr.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

const db = require('../src/config/database');
const dolibarrService = require('../src/services/dolibarrService');

async function syncAllProducts() {
    try {
        console.log('🔄 Sincronizando todos los productos con Dolibarr...\n');
        
        // Obtener todos los productos
        const result = await db.query('SELECT * FROM products WHERE is_active = true');
        const products = result.rows;
        
        console.log(`📦 Total de productos a sincronizar: ${products.length}\n`);
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const product of products) {
            try {
                console.log(`⏳ Sincronizando: ${product.name} (SKU: ${product.sku})...`);
                const syncResult = await dolibarrService.syncProduct(product);
                if (syncResult.dolibarr_id) {
                    console.log(`✅ Sincronizado: ${product.name} - ID Dolibarr: ${syncResult.dolibarr_id}`);
                    successCount++;
                } else {
                    console.error(`⚠️ Sincronización incompleta para ${product.name}: No se obtuvo ID de Dolibarr`);
                    errorCount++;
                }
            } catch (error) {
                console.error(`❌ Error sincronizando ${product.name}:`, error.message);
                errorCount++;
            }
        }
        
        console.log(`\n✅ Sincronización completada:`);
        console.log(`   - Exitosos: ${successCount}`);
        console.log(`   - Errores: ${errorCount}`);
        console.log(`\n💡 CÓMO VER LOS PRODUCTOS EN DOLIBARR:`);
        console.log(`   1. Ve a: https://nettechsolutions.with1.doliplace.fr`);
        console.log(`   2. En el menú lateral izquierdo, haz clic en "Productos" → "Lista"`);
        console.log(`   3. O usa este enlace directo: https://nettechsolutions.with1.doliplace.fr/product/list.php`);
        console.log(`\n🔍 Para verificar los productos sincronizados, ejecuta:`);
        console.log(`   node scripts/verify-dolibarr-products.js`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await db.close();
        process.exit(0);
    }
}

syncAllProducts();

