/**
 * Script para verificar el producto "0000" en la base de datos
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

const db = require('../src/config/database');

async function verificarProducto() {
    console.log('🔍 Verificando producto "0000" en la base de datos...\n');

    try {
        // 1. Buscar producto por SKU
        console.log('1️⃣ Buscando producto por SKU "0000"...');
        const productoPorSKU = await db.query(
            'SELECT * FROM products WHERE sku = $1',
            ['0000']
        );

        if (productoPorSKU.rows.length > 0) {
            console.log('✅ Producto encontrado por SKU:');
            console.log(JSON.stringify(productoPorSKU.rows[0], null, 2));
        } else {
            console.log('❌ No se encontró producto con SKU "0000"');
        }
        console.log('');

        // 2. Buscar producto por nombre
        console.log('2️⃣ Buscando producto por nombre "0000"...');
        const productoPorNombre = await db.query(
            'SELECT * FROM products WHERE name = $1 OR name LIKE $2',
            ['0000', '%0000%']
        );

        if (productoPorNombre.rows.length > 0) {
            console.log('✅ Producto encontrado por nombre:');
            productoPorNombre.rows.forEach(p => {
                console.log(`   - ID: ${p.id}, Nombre: ${p.name}, SKU: ${p.sku}, Activo: ${p.is_active}, Dolibarr ID: ${p.dolibarr_id}`);
            });
        } else {
            console.log('❌ No se encontró producto con nombre "0000"');
        }
        console.log('');

        // 3. Buscar todos los productos activos
        console.log('3️⃣ Verificando productos activos en el catálogo...');
        const productosActivos = await db.query(`
            SELECT 
                id, name, sku, price, stock, is_active, 
                dolibarr_id, last_sync_source, dolibarr_synced_at
            FROM products 
            WHERE is_active = true
            ORDER BY name
        `);

        console.log(`✅ Total de productos activos: ${productosActivos.rows.length}`);
        console.log('\n   Lista de productos activos:');
        productosActivos.rows.forEach((p, index) => {
            console.log(`   ${index + 1}. ${p.name} (SKU: ${p.sku}, Stock: ${p.stock}, Dolibarr ID: ${p.dolibarr_id || 'N/A'})`);
        });
        console.log('');

        // 4. Buscar productos con dolibarr_id
        console.log('4️⃣ Verificando productos sincronizados desde Dolibarr...');
        const productosDolibarr = await db.query(`
            SELECT 
                id, name, sku, price, stock, is_active, 
                dolibarr_id, last_sync_source, dolibarr_synced_at
            FROM products 
            WHERE dolibarr_id IS NOT NULL
            ORDER BY dolibarr_synced_at DESC
        `);

        console.log(`✅ Total de productos con dolibarr_id: ${productosDolibarr.rows.length}`);
        console.log('\n   Últimos productos sincronizados:');
        productosDolibarr.rows.slice(0, 5).forEach((p, index) => {
            const syncedAt = p.dolibarr_synced_at ? new Date(p.dolibarr_synced_at).toLocaleString() : 'N/A';
            console.log(`   ${index + 1}. ${p.name} (SKU: ${p.sku}, Dolibarr ID: ${p.dolibarr_id}, Activo: ${p.is_active}, Sincronizado: ${syncedAt})`);
        });
        console.log('');

        // 5. Verificar si hay productos inactivos con SKU 0000
        console.log('5️⃣ Verificando productos inactivos con SKU "0000"...');
        const productosInactivos = await db.query(`
            SELECT * FROM products 
            WHERE sku = '0000' AND is_active = false
        `);

        if (productosInactivos.rows.length > 0) {
            console.log('⚠️  Producto encontrado pero está INACTIVO:');
            console.log(JSON.stringify(productosInactivos.rows[0], null, 2));
        } else {
            console.log('ℹ️  No hay productos inactivos con SKU "0000"');
        }
        console.log('');

        // 6. Verificar productos recientes
        console.log('6️⃣ Verificando productos creados/actualizados recientemente...');
        const productosRecientes = await db.query(`
            SELECT 
                id, name, sku, price, stock, is_active, 
                dolibarr_id, created_at, updated_at, dolibarr_synced_at
            FROM products 
            ORDER BY COALESCE(updated_at, created_at) DESC
            LIMIT 10
        `);

        console.log('   Últimos 10 productos (por fecha de actualización):');
        productosRecientes.rows.forEach((p, index) => {
            const fecha = p.updated_at || p.created_at;
            const fechaStr = fecha ? new Date(fecha).toLocaleString() : 'N/A';
            console.log(`   ${index + 1}. ${p.name} (SKU: ${p.sku}, Activo: ${p.is_active}, Dolibarr ID: ${p.dolibarr_id || 'N/A'}, Fecha: ${fechaStr})`);
        });

    } catch (error) {
        console.error('❌ Error verificando producto:', error);
        if (error.stack) {
            console.error('Stack:', error.stack);
        }
    } finally {
        await db.close();
    }
}

// Ejecutar verificación
if (require.main === module) {
    verificarProducto()
        .then(() => {
            console.log('\n✅ Verificación completada');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { verificarProducto };

