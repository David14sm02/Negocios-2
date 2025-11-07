/**
 * Script para probar el login y obtener token de Dolibarr
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'config.env') });
const axios = require('axios');

async function testLogin() {
    const baseURL = process.env.DOLIBARR_URL;
    const user = process.env.DOLIBARR_API_USER;
    const password = process.env.DOLIBARR_API_PASSWORD;

    console.log('🧪 Probando login en Dolibarr...\n');
    console.log(`URL: ${baseURL}`);
    console.log(`Usuario: ${user}\n`);

    try {
        // Intentar obtener token
        const loginUrl = `${baseURL}/api/index.php/login?login=${encodeURIComponent(user)}&password=${encodeURIComponent(password)}`;
        console.log(`🔗 URL de login: ${loginUrl.replace(password, '***')}\n`);
        
        const response = await axios.get(loginUrl, {
            validateStatus: function (status) {
                return status < 500; // Aceptar cualquier status menor a 500
            }
        });

        console.log('📊 Status:', response.status);
        console.log('📦 Headers:', JSON.stringify(response.headers, null, 2));
        console.log('📄 Response:', JSON.stringify(response.data, null, 2));

        if (response.status === 200) {
            console.log('\n✅ Login exitoso!');
            if (response.data && response.data.token) {
                console.log(`🔑 Token: ${response.data.token}`);
            }
        } else {
            console.log('\n❌ Error en login');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testLogin();

