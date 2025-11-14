/**
 * Script para probar el webhook de Dolibarr
 * Simula las notificaciones que enviaría Dolibarr
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

const axios = require('axios');

const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/api/dolibarr/webhook';
const WEBHOOK_SECRET = process.env.DOLIBARR_WEBHOOK_SECRET || 'test-secret';

async function testWebhook() {
    console.log('🧪 Probando webhook de Dolibarr...\n');
    console.log(`📍 URL del webhook: ${WEBHOOK_URL}`);
    console.log(`🔐 Secret: ${WEBHOOK_SECRET ? 'Configurado' : 'No configurado'}\n`);

    const tests = [
        {
            name: 'Producto creado',
            event: 'product.created',
            data: {
                id: 1,
                ref: 'TEST-PRODUCT-001',
                label: 'Producto de Prueba',
                price: 100,
                stock_reel: 50
            }
        },
        {
            name: 'Producto actualizado',
            event: 'product.updated',
            data: {
                id: 1,
                ref: 'TEST-PRODUCT-001',
                label: 'Producto de Prueba Actualizado',
                price: 120,
                stock_reel: 45
            }
        },
        {
            name: 'Stock actualizado',
            event: 'stock.updated',
            data: {
                id: 1,
                product_id: 1,
                ref: 'TEST-PRODUCT-001',
                sku: 'TEST-PRODUCT-001',
                stock: 40
            }
        },
        {
            name: 'Movimiento de stock',
            event: 'stock.movement',
            data: {
                product_id: 1,
                ref: 'TEST-PRODUCT-001',
                sku: 'TEST-PRODUCT-001',
                quantity: -5,
                type: 'out'
            }
        }
    ];

    for (const test of tests) {
        try {
            console.log(`\n📤 Enviando evento: ${test.name} (${test.event})...`);
            
            const response = await axios.post(WEBHOOK_URL, {
                event: test.event,
                data: test.data
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Dolibarr-Secret': WEBHOOK_SECRET
                },
                validateStatus: () => true // Aceptar cualquier status
            });

            if (response.status === 200 && response.data.success) {
                console.log(`   ✅ Webhook procesado exitosamente`);
                console.log(`   📋 Respuesta: ${JSON.stringify(response.data, null, 2)}`);
            } else {
                console.log(`   ⚠️  Webhook respondió con status ${response.status}`);
                console.log(`   📋 Respuesta: ${JSON.stringify(response.data, null, 2)}`);
            }
        } catch (error) {
            if (error.response) {
                console.log(`   ❌ Error HTTP ${error.response.status}: ${error.response.statusText}`);
                console.log(`   📋 Respuesta: ${JSON.stringify(error.response.data, null, 2)}`);
            } else if (error.request) {
                console.log(`   ❌ No se pudo conectar al servidor`);
                console.log(`   💡 Asegúrate de que el servidor esté corriendo en ${WEBHOOK_URL}`);
            } else {
                console.log(`   ❌ Error: ${error.message}`);
            }
        }
    }

    console.log('\n\n💡 NOTAS:');
    console.log('   - Si el servidor no está corriendo, inícialo con: npm start');
    console.log('   - Verifica los logs del servidor para ver cómo se procesaron los eventos');
    console.log('   - Revisa la tabla integration_logs en la BD para ver los registros');
    console.log('   - Para probar con datos reales, usa productos que existan en Dolibarr\n');
}

// Ejecutar pruebas
testWebhook()
    .then(() => {
        console.log('✅ Pruebas completadas\n');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error en las pruebas:', error);
        process.exit(1);
    });

