/**
 * Servicio de polling automático para sincronización desde Dolibarr
 * Se ejecuta automáticamente cada 15 minutos
 */

const cron = require('node-cron');
const db = require('../config/database');
const dolibarrService = require('./dolibarrService');

let isRunning = false;
let lastRun = null;
let nextRun = null;

/**
 * Ejecutar sincronización desde Dolibarr
 */
async function ejecutarSincronizacion() {
    // Evitar ejecuciones simultáneas
    if (isRunning) {
        console.log('⏸️  Sincronización ya en curso, saltando esta ejecución...');
        return;
    }

    isRunning = true;
    lastRun = new Date();

    try {
        console.log('🔄 [POLLING] Iniciando sincronización automática desde Dolibarr...');
        
        const result = await dolibarrService.syncAllProductsFromDolibarr(db, {
            onlyNew: false,  // Sincronizar todos los productos
            updateStock: true,  // Actualizar stock
            limit: null  // Sin límite
        });

        console.log(`✅ [POLLING] Sincronización completada:`);
        console.log(`   - Total procesados: ${result.total}`);
        console.log(`   - Exitosos: ${result.successCount}`);
        console.log(`   - Errores: ${result.errorCount}`);
        
        if (result.errors.length > 0 && result.errors.length <= 5) {
            console.log(`   ⚠️  Errores: ${result.errors.map(e => e.product).join(', ')}`);
        }

        // Calcular próxima ejecución
        nextRun = new Date(Date.now() + 15 * 60 * 1000);
        
    } catch (error) {
        console.error('❌ [POLLING] Error en sincronización automática:', error.message);
    } finally {
        isRunning = false;
    }
}

/**
 * Inicializar servicio de polling
 */
function iniciarPolling() {
    // Verificar si está habilitado
    const pollingEnabled = process.env.DOLIBARR_POLLING_ENABLED !== 'false';
    
    if (!pollingEnabled) {
        console.log('ℹ️  Polling automático deshabilitado (DOLIBARR_POLLING_ENABLED=false)');
        return;
    }

    // Obtener intervalo desde variable de entorno (default: 15 minutos)
    const intervalMinutes = parseInt(process.env.DOLIBARR_POLLING_INTERVAL) || 15;
    
    // Validar intervalo mínimo (no menos de 1 minuto)
    const safeInterval = Math.max(1, intervalMinutes);

    // Configurar cron: ejecutar cada X minutos
    const cronExpression = `*/${safeInterval} * * * *`;
    
    console.log(`⏰ [POLLING] Configurando sincronización automática cada ${safeInterval} minutos...`);
    
    // Programar tarea
    cron.schedule(cronExpression, ejecutarSincronizacion, {
        scheduled: true,
        timezone: "America/Mexico_City" // Ajustar según tu zona horaria
    });

    // Ejecutar inmediatamente al iniciar (opcional)
    const runOnStart = process.env.DOLIBARR_POLLING_RUN_ON_START !== 'false';
    if (runOnStart) {
        console.log('🚀 [POLLING] Ejecutando sincronización inicial...');
        // Ejecutar después de 10 segundos para dar tiempo a que el servidor inicie
        setTimeout(ejecutarSincronizacion, 10000);
    }

    // Calcular próxima ejecución
    nextRun = new Date(Date.now() + safeInterval * 60 * 1000);

    console.log(`✅ [POLLING] Polling automático configurado (cada ${safeInterval} minutos)`);
    console.log(`📅 [POLLING] Próxima ejecución: ${nextRun.toLocaleString()}`);
}

/**
 * Obtener estado del polling
 */
function getEstado() {
    return {
        enabled: process.env.DOLIBARR_POLLING_ENABLED !== 'false',
        interval: parseInt(process.env.DOLIBARR_POLLING_INTERVAL) || 15,
        isRunning,
        lastRun,
        nextRun
    };
}

/**
 * Ejecutar sincronización manualmente
 */
async function ejecutarManual() {
    console.log('🔄 [POLLING] Ejecución manual iniciada...');
    await ejecutarSincronizacion();
}

module.exports = {
    iniciarPolling,
    ejecutarManual,
    getEstado
};

