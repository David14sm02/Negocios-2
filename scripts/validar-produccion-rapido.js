/**
 * Validación rápida pre-producción
 * Versión simplificada que muestra resultados inmediatamente
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

console.log('🔍 VALIDACIÓN PRE-PRODUCCIÓN (Versión Rápida)\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let errores = [];
let advertencias = [];
let exitos = [];

// 1. Variables críticas
console.log('1️⃣ Variables de entorno críticas...\n');

const varsCriticas = {
    'DATABASE_URL': 'Base de datos',
    'JWT_SECRET': 'JWT Secret',
    'DOLIBARR_URL': 'URL Dolibarr',
    'DOLIBARR_API_USER': 'Usuario API Dolibarr',
    'DOLIBARR_API_PASSWORD': 'Password API Dolibarr',
    'DOLIBARR_DEFAULT_WAREHOUSE_ID': 'ID Almacén',
    'DOLIBARR_WEBHOOK_SECRET': 'Webhook Secret',
    'DOLIBARR_POLLING_ENABLED': 'Polling habilitado',
    'DOLIBARR_POLLING_INTERVAL': 'Intervalo polling'
};

for (const [varName, desc] of Object.entries(varsCriticas)) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
        errores.push(`❌ ${varName}: NO configurada`);
    } else {
        const display = varName.includes('PASSWORD') || varName.includes('SECRET') 
            ? '***' + value.slice(-4) 
            : value.length > 30 ? value.substring(0, 30) + '...' : value;
        exitos.push(`✅ ${varName}: OK (${display})`);
    }
}

// 2. NODE_ENV
console.log('2️⃣ Ambiente...\n');
const nodeEnv = process.env.NODE_ENV || 'development';
if (nodeEnv !== 'production') {
    advertencias.push(`⚠️ NODE_ENV=${nodeEnv} (debería ser 'production')`);
} else {
    exitos.push('✅ NODE_ENV=production');
}

// 3. Verificar archivos
console.log('3️⃣ Archivos necesarios...\n');
const fs = require('fs');

const archivos = [
    { path: 'vercel.json', desc: 'Configuración Vercel' },
    { path: 'api/cron/sync-dolibarr.js', desc: 'Endpoint cron' },
    { path: 'src/services/dolibarrService.js', desc: 'Servicio Dolibarr' },
    { path: 'src/services/pollingService.js', desc: 'Servicio polling' }
];

archivos.forEach(archivo => {
    const fullPath = path.join(__dirname, '..', archivo.path);
    if (fs.existsSync(fullPath)) {
        exitos.push(`✅ ${archivo.desc}: Existe`);
    } else {
        errores.push(`❌ ${archivo.desc}: NO existe (${archivo.path})`);
    }
});

// 4. Verificar vercel.json
console.log('4️⃣ Configuración Vercel...\n');
try {
    const vercelPath = path.join(__dirname, '..', 'vercel.json');
    if (fs.existsSync(vercelPath)) {
        const vercelJson = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
        if (vercelJson.crons && vercelJson.crons.length > 0) {
            exitos.push(`✅ Cron jobs configurados: ${vercelJson.crons.length}`);
        } else {
            advertencias.push('⚠️ vercel.json no tiene cron jobs');
        }
    }
} catch (error) {
    advertencias.push(`⚠️ Error leyendo vercel.json: ${error.message}`);
}

// Mostrar resultados
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 RESULTADOS:\n');

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

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📋 RESUMEN:\n');
console.log(`   ✅ Exitos: ${exitos.length}`);
console.log(`   ⚠️  Advertencias: ${advertencias.length}`);
console.log(`   ❌ Errores: ${errores.length}\n`);

if (errores.length > 0) {
    console.log('❌ NO LISTO - Corrige los errores antes de desplegar\n');
    console.log('💡 PRÓXIMOS PASOS:');
    console.log('   1. Agregar variables faltantes en config.env');
    console.log('   2. Crear archivos faltantes');
    console.log('   3. Ejecutar de nuevo: node scripts/validar-produccion-rapido.js\n');
    process.exit(1);
} else if (advertencias.length > 0) {
    console.log('⚠️ CASI LISTO - Revisa las advertencias\n');
    process.exit(0);
} else {
    console.log('✅ LISTO PARA PRODUCCIÓN\n');
    console.log('💡 PRÓXIMOS PASOS:');
    console.log('   1. Agregar variables de entorno en Vercel');
    console.log('   2. Verificar almacén en Dolibarr');
    console.log('   3. Desplegar y verificar logs\n');
    process.exit(0);
}

