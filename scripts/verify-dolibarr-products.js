/**
 * Script para verificar los productos sincronizados en Dolibarr
 * Ejecuta: node scripts/verify-dolibarr-products.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

const db = require('../src/config/database');
const dolibarrService = require('../src/services/dolibarrService');

async function verifyProducts() {
    try {
        console.log('🔍 Verificando productos sincronizados en Dolibarr...\n');
        
        // Obtener productos de la base de datos local
        const localProducts = await db.query('SELECT * FROM products WHERE is_active = true');
        console.log(`📦 Productos en la base de datos local: ${localProducts.rows.length}\n`);
        
        // Obtener productos de Dolibarr
        console.log('📡 Obteniendo productos de Dolibarr...');
        const dolibarrResult = await dolibarrService.getProducts();
        const dolibarrProducts = dolibarrResult.data || [];
        
        console.log(`📦 Productos en Dolibarr: ${dolibarrProducts.length}\n`);
        
        if (dolibarrProducts.length === 0) {
            console.log('⚠️ No se encontraron productos en Dolibarr.');
            console.log('💡 Ejecuta: node scripts/sync-all-products-to-dolibarr.js\n');
            await db.close();
            process.exit(0);
        }
        
        // Mostrar productos de Dolibarr
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('📋 PRODUCTOS EN DOLIBARR:');
        console.log('═══════════════════════════════════════════════════════════════\n');
        
        dolibarrProducts.forEach((product, index) => {
            console.log(`${index + 1}. ID: ${product.id}`);
            console.log(`   Referencia (SKU): ${product.ref || 'N/A'}`);
            console.log(`   Nombre: ${product.label || 'N/A'}`);
            console.log(`   Precio: $${product.price || '0.00'}`);
            console.log(`   Estado: ${product.status === 1 ? '✅ Activo' : '❌ Inactivo'}`);
            console.log(`   Tipo: ${product.type === 0 ? 'Producto' : product.type === 1 ? 'Servicio' : 'Otro'}`);
            console.log(`   URL: https://nettechsolutions.with1.doliplace.fr/product/card.php?id=${product.id}`);
            console.log('');
        });
        
        // Comparar con productos locales
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('🔄 COMPARACIÓN CON BASE DE DATOS LOCAL:');
        console.log('═══════════════════════════════════════════════════════════════\n');
        
        const dolibarrSkus = new Set(dolibarrProducts.map(p => p.ref).filter(Boolean));
        const localSkus = new Set(localProducts.rows.map(p => p.sku));
        
        console.log(`✅ Productos sincronizados: ${localProducts.rows.filter(p => dolibarrSkus.has(p.sku)).length}/${localProducts.rows.length}`);
        console.log(`❌ Productos no sincronizados: ${localProducts.rows.filter(p => !dolibarrSkus.has(p.sku)).length}\n`);
        
        // Mostrar productos no sincronizados
        const notSynced = localProducts.rows.filter(p => !dolibarrSkus.has(p.sku));
        if (notSynced.length > 0) {
            console.log('📋 Productos que NO están en Dolibarr:');
            notSynced.forEach(p => {
                console.log(`   - ${p.name} (SKU: ${p.sku})`);
            });
            console.log('');
        }
        
        // Mostrar productos en Dolibarr que no están en la BD local
        const extraProducts = dolibarrProducts.filter(p => p.ref && !localSkus.has(p.ref));
        if (extraProducts.length > 0) {
            console.log('📋 Productos en Dolibarr que NO están en la BD local:');
            extraProducts.forEach(p => {
                console.log(`   - ${p.label} (SKU: ${p.ref})`);
            });
            console.log('');
        }
        
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('💡 CÓMO VER LOS PRODUCTOS EN DOLIBARR:');
        console.log('═══════════════════════════════════════════════════════════════\n');
        console.log('1. Ve a: https://nettechsolutions.with1.doliplace.fr');
        console.log('2. En el menú lateral izquierdo, haz clic en "Productos" → "Lista"');
        console.log('3. Verás todos los productos sincronizados\n');
        console.log('O usa estos enlaces directos:');
        console.log('   - Lista de productos: https://nettechsolutions.with1.doliplace.fr/product/list.php');
        console.log('   - Área de productos: https://nettechsolutions.with1.doliplace.fr/product/index.php\n');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response?.data) {
            console.error('Detalles:', JSON.stringify(error.response.data, null, 2));
        }
    } finally {
        await db.close();
        process.exit(0);
    }
}

verifyProducts();

