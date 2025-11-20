/**
 * Script para verificar qué productos devuelve la consulta SQL de la API
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

const db = require('../src/config/database');

async function verificarConsulta() {
    console.log('🔍 Verificando consulta SQL de la API...\n');

    try {
        // Simular la consulta exacta que hace la API
        const limit = 100;
        const offset = 0;
        const sort = 'name';
        const order = 'ASC';
        
        const whereConditions = ['p.is_active = true'];
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const orderBy = `ORDER BY p.${sort} ${order.toUpperCase()}`;
        
        const query = `
            SELECT 
                p.id,
                p.name,
                p.description,
                p.price,
                p.sku,
                p.stock,
                p.min_stock,
                p.image_url,
                p.specifications,
                p.features,
                p.tags,
                p.brand,
                p.weight,
                p.dimensions,
                p.is_featured,
                p.created_at,
                p.updated_at,
                c.name as category_name,
                c.id as category_id
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            ${whereClause}
            ${orderBy}
            LIMIT $1 OFFSET $2
        `;

        console.log('📝 Ejecutando consulta SQL:');
        console.log(query);
        console.log(`   Parámetros: limit=${limit}, offset=${offset}\n`);

        const result = await db.query(query, [limit, offset]);

        console.log(`✅ Total de productos devueltos: ${result.rows.length}\n`);
        
        console.log('📦 Lista de productos (ordenados por nombre):');
        result.rows.forEach((p, index) => {
            console.log(`   ${index + 1}. ${p.name} (SKU: ${p.sku}, ID: ${p.id}, Stock: ${p.stock})`);
        });

        // Verificar si "0000" está en la lista
        const producto0000 = result.rows.find(p => p.sku === '0000' || p.name === '0000');
        if (producto0000) {
            console.log('\n✅ Producto "0000" encontrado en la consulta:');
            console.log(JSON.stringify(producto0000, null, 2));
        } else {
            console.log('\n❌ Producto "0000" NO está en los resultados de la consulta');
        }

        // Contar total
        const countQuery = `
            SELECT COUNT(*) as total
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            ${whereClause}
        `;
        
        const countResult = await db.query(countQuery, []);
        const total = parseInt(countResult.rows[0].total);
        
        console.log(`\n📊 Total de productos activos en la base de datos: ${total}`);
        console.log(`📊 Productos devueltos por la consulta: ${result.rows.length}`);
        
        if (total !== result.rows.length && result.rows.length < limit) {
            console.log('\n⚠️  ADVERTENCIA: Hay más productos activos que los devueltos, pero no se alcanzó el límite');
            console.log('   Esto sugiere un problema con la consulta SQL');
        }

    } catch (error) {
        console.error('❌ Error ejecutando consulta:', error);
        if (error.stack) {
            console.error('Stack:', error.stack);
        }
    } finally {
        await db.close();
    }
}

if (require.main === module) {
    verificarConsulta()
        .then(() => {
            console.log('\n✅ Verificación completada');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { verificarConsulta };

