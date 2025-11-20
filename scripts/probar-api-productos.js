/**
 * Script para probar la API de productos y ver qué devuelve
 */

const axios = require('axios');

async function probarAPI() {
    try {
        console.log('🔍 Probando API de productos...\n');
        
        const response = await axios.get('http://localhost:3000/api/products', {
            params: {
                limit: 100,
                page: 1
            }
        });

        if (response.data.success) {
            const productos = response.data.data || [];
            const pagination = response.data.pagination || {};
            
            console.log(`✅ Total de productos según paginación: ${pagination.total || productos.length}`);
            console.log(`✅ Productos devueltos en esta página: ${productos.length}`);
            console.log('\n📦 Lista de productos devueltos por la API:');
            
            productos.forEach((p, index) => {
                console.log(`   ${index + 1}. ${p.name} (SKU: ${p.sku}, ID: ${p.id}, Activo: ${p.is_active !== false})`);
            });
            
            // Verificar si el producto "0000" está en la lista
            const producto0000 = productos.find(p => p.sku === '0000' || p.name === '0000');
            if (producto0000) {
                console.log('\n✅ Producto "0000" encontrado en la respuesta de la API:');
                console.log(JSON.stringify(producto0000, null, 2));
            } else {
                console.log('\n❌ Producto "0000" NO está en la respuesta de la API');
                console.log('   Esto significa que hay un problema con la consulta SQL o el filtrado');
            }
            
        } else {
            console.log('❌ La API no devolvió success: true');
            console.log(response.data);
        }
        
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.log('❌ Error: El servidor no está corriendo en localhost:3000');
            console.log('   Por favor, inicia el servidor con: node src/server.js');
        } else {
            console.error('❌ Error probando la API:', error.message);
            if (error.response) {
                console.error('   Status:', error.response.status);
                console.error('   Data:', error.response.data);
            }
        }
    }
}

if (require.main === module) {
    probarAPI()
        .then(() => {
            console.log('\n✅ Prueba completada');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { probarAPI };

