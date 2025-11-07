/**
 * Script para probar la conexión con Dolibarr
 * Ejecuta: node test-dolibarr.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'config.env') });

const dolibarrService = require('./src/services/dolibarrService');

async function testDolibarr() {
    console.log('🧪 Probando conexión con Dolibarr...\n');
    
    console.log('📋 Configuración:');
    console.log(`   URL: ${process.env.DOLIBARR_URL || 'NO CONFIGURADA'}`);
    console.log(`   Usuario: ${process.env.DOLIBARR_API_USER || 'NO CONFIGURADO'}`);
    console.log(`   API Key: ${process.env.DOLIBARR_API_KEY ? '✅ Configurada' : '❌ No configurada'}\n`);
    
    try {
        const result = await dolibarrService.testConnection();
        
        if (result.success) {
            console.log('✅ ¡Conexión exitosa con Dolibarr!');
            console.log('📊 Datos:', JSON.stringify(result.data, null, 2));
        } else {
            console.log('❌ Error de conexión:', result.error);
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('\n💡 Verifica:');
        console.log('   1. Que DOLIBARR_URL esté correcta en config.env');
        console.log('   2. Que DOLIBARR_API_USER y DOLIBARR_API_PASSWORD estén configurados');
        console.log('   3. Que el usuario tenga permisos para usar la API');
        console.log('   4. Que el módulo WebServices esté habilitado en Dolibarr');
    }
}

testDolibarr();

