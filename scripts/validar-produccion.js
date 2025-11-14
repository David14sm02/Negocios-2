/**
 * Script de validación pre-producción
 * Verifica que todas las variables de entorno y configuraciones estén correctas
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

const db = require('../src/config/database');
const dolibarrService = require('../src/services/dolibarrService');

const REQUIRED_VARS = {
    // Base de datos
    'DATABASE_URL': 'URL de conexión a PostgreSQL',
    
    // Seguridad
    'JWT_SECRET': 'Secret para JWT tokens',
    
    // Dolibarr
    'DOLIBARR_URL': 'URL de Dolibarr',
    'DOLIBARR_API_USER': 'Usuario API de Dolibarr',
    'DOLIBARR_API_PASSWORD': 'Contraseña API de Dolibarr',
    'DOLIBARR_DEFAULT_WAREHOUSE_ID': 'ID del almacén por defecto',
    'DOLIBARR_WEBHOOK_SECRET': 'Secret para webhooks',
    
    // Polling
    'DOLIBARR_POLLING_ENABLED': 'Habilitar polling automático',
    'DOLIBARR_POLLING_INTERVAL': 'Intervalo de polling en minutos',
    
    // Stripe (si se usa)
    'STRIPE_SECRET_KEY': 'Clave secreta de Stripe',
};

const RECOMMENDED_VARS = {
    'CORS_ORIGIN': 'Origen permitido para CORS',
    'NODE_ENV': 'Ambiente de ejecución',
    'PORT': 'Puerto del servidor',
};

async function validarProduccion() {
    console.log('🔍 VALIDACIÓN PRE-PRODUCCIÓN\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let errores = [];
    let advertencias = [];
    let exitos = [];

    // 1. Validar variables de entorno requeridas
    console.log('1️⃣ Validando variables de entorno requeridas...\n');
    for (const [varName, description] of Object.entries(REQUIRED_VARS)) {
        const value = process.env[varName];
        if (!value || value.trim() === '') {
            errores.push(`❌ ${varName}: NO configurada - ${description}`);
        } else {
            // Ocultar valores sensibles
            const displayValue = varName.includes('PASSWORD') || varName.includes('SECRET') || varName.includes('KEY')
                ? '***' + value.slice(-4)
                : value;
            exitos.push(`✅ ${varName}: Configurada (${displayValue})`);
        }
    }

    // 2. Validar variables recomendadas
    console.log('2️⃣ Validando variables recomendadas...\n');
    for (const [varName, description] of Object.entries(RECOMMENDED_VARS)) {
        const value = process.env[varName];
        if (!value || value.trim() === '') {
            advertencias.push(`⚠️ ${varName}: No configurada - ${description} (recomendado)`);
        } else {
            exitos.push(`✅ ${varName}: Configurada`);
        }
    }

    // 3. Validar NODE_ENV
    console.log('3️⃣ Validando ambiente...\n');
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv !== 'production') {
        advertencias.push(`⚠️ NODE_ENV=${nodeEnv} (debería ser 'production' en producción)`);
    } else {
        exitos.push(`✅ NODE_ENV=production`);
    }

    // 4. Validar conexión a base de datos
    console.log('4️⃣ Validando conexión a base de datos...\n');
    try {
        await db.testConnection();
        exitos.push('✅ Conexión a base de datos: OK');
    } catch (error) {
        errores.push(`❌ Conexión a base de datos: FALLIDA - ${error.message}`);
    }

    // 5. Validar estructura de base de datos
    console.log('5️⃣ Validando estructura de base de datos...\n');
    try {
        const columns = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'products' 
            AND column_name IN ('dolibarr_id', 'dolibarr_synced_at', 'sync_direction', 'last_sync_source')
        `);
        
        const requiredColumns = ['dolibarr_id', 'dolibarr_synced_at', 'sync_direction', 'last_sync_source'];
        const foundColumns = columns.rows.map(r => r.column_name);
        const missingColumns = requiredColumns.filter(col => !foundColumns.includes(col));
        
        if (missingColumns.length > 0) {
            errores.push(`❌ Columnas faltantes en tabla products: ${missingColumns.join(', ')}`);
        } else {
            exitos.push('✅ Estructura de base de datos: OK');
        }
    } catch (error) {
        errores.push(`❌ Error validando estructura de BD: ${error.message}`);
    }

    // 6. Validar conexión con Dolibarr
    console.log('6️⃣ Validando conexión con Dolibarr...\n');
    try {
        const connectionTest = await dolibarrService.testConnection();
        if (connectionTest.success) {
            exitos.push('✅ Conexión con Dolibarr: OK');
        } else {
            errores.push(`❌ Conexión con Dolibarr: FALLIDA - ${connectionTest.error || 'Error desconocido'}`);
        }
    } catch (error) {
        errores.push(`❌ Error conectando con Dolibarr: ${error.message}`);
    }

    // 7. Validar almacén en Dolibarr
    console.log('7️⃣ Validando almacén en Dolibarr...\n');
    try {
        const warehouseId = process.env.DOLIBARR_DEFAULT_WAREHOUSE_ID;
        if (warehouseId) {
            // Intentar obtener información del almacén
            try {
                const warehouse = await dolibarrService.request('GET', `/warehouses/${warehouseId}`);
                exitos.push(`✅ Almacén ${warehouseId} existe en Dolibarr: ${warehouse.label || warehouse.name || 'OK'}`);
            } catch (error) {
                advertencias.push(`⚠️ Almacén ${warehouseId} no encontrado en Dolibarr (verificar que existe)`);
            }
        }
    } catch (error) {
        advertencias.push(`⚠️ No se pudo validar almacén: ${error.message}`);
    }

    // 8. Validar configuración de polling
    console.log('8️⃣ Validando configuración de polling...\n');
    const pollingEnabled = process.env.DOLIBARR_POLLING_ENABLED !== 'false';
    const pollingInterval = parseInt(process.env.DOLIBARR_POLLING_INTERVAL) || 15;
    
    if (pollingEnabled) {
        exitos.push(`✅ Polling habilitado (cada ${pollingInterval} minutos)`);
    } else {
        advertencias.push('⚠️ Polling deshabilitado (DOLIBARR_POLLING_ENABLED=false)');
    }

    // 9. Validar vercel.json
    console.log('9️⃣ Validando vercel.json...\n');
    try {
        const fs = require('fs');
        const vercelJsonPath = path.join(__dirname, '..', 'vercel.json');
        if (fs.existsSync(vercelJsonPath)) {
            const vercelJson = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
            if (vercelJson.crons && vercelJson.crons.length > 0) {
                exitos.push('✅ vercel.json configurado con cron jobs');
            } else {
                advertencias.push('⚠️ vercel.json no tiene cron jobs configurados');
            }
        } else {
            advertencias.push('⚠️ vercel.json no existe');
        }
    } catch (error) {
        advertencias.push(`⚠️ Error validando vercel.json: ${error.message}`);
    }

    // 10. Validar endpoint de cron
    console.log('🔟 Validando endpoint de cron...\n');
    try {
        const fs = require('fs');
        const cronPath = path.join(__dirname, '..', 'api', 'cron', 'sync-dolibarr.js');
        if (fs.existsSync(cronPath)) {
            exitos.push('✅ Endpoint de cron existe: api/cron/sync-dolibarr.js');
        } else {
            errores.push('❌ Endpoint de cron no existe: api/cron/sync-dolibarr.js');
        }
    } catch (error) {
        errores.push(`❌ Error validando endpoint de cron: ${error.message}`);
    }

    // Mostrar resultados
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESULTADOS DE VALIDACIÓN\n');

    if (exitos.length > 0) {
        console.log('✅ EXITOS:');
        exitos.forEach(msg => console.log(`   ${msg}`));
        console.log('');
    }

    if (advertencias.length > 0) {
        console.log('⚠️ ADVERTENCIAS:');
        advertencias.forEach(msg => console.log(`   ${msg}`));
        console.log('');
    }

    if (errores.length > 0) {
        console.log('❌ ERRORES:');
        errores.forEach(msg => console.log(`   ${msg}`));
        console.log('');
    }

    // Resumen final
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 RESUMEN:\n');
    console.log(`   ✅ Exitos: ${exitos.length}`);
    console.log(`   ⚠️  Advertencias: ${advertencias.length}`);
    console.log(`   ❌ Errores: ${errores.length}\n`);

    if (errores.length > 0) {
        console.log('❌ NO LISTO PARA PRODUCCIÓN - Corrige los errores antes de desplegar\n');
        process.exit(1);
    } else if (advertencias.length > 0) {
        console.log('⚠️ LISTO CON ADVERTENCIAS - Revisa las advertencias antes de desplegar\n');
        process.exit(0);
    } else {
        console.log('✅ LISTO PARA PRODUCCIÓN - Todas las validaciones pasaron\n');
        process.exit(0);
    }
}

// Ejecutar validación
validarProduccion()
    .then(() => {
        // Ya se maneja el exit en la función
    })
    .catch((error) => {
        console.error('❌ Error fatal en validación:', error);
        process.exit(1);
    })
    .finally(async () => {
        await db.close();
    });

