/**
 * Endpoint para Vercel Cron Jobs
 * Se ejecuta automáticamente según la configuración en vercel.json
 * 
 * Este endpoint reemplaza el polling automático en Vercel
 * porque las funciones serverless no mantienen procesos en ejecución
 */

const db = require('../../src/config/database');
const dolibarrService = require('../../src/services/dolibarrService');

module.exports = async (req, res) => {
    // Verificar que es una llamada autorizada (desde Vercel Cron)
    // Vercel automáticamente envía un header 'x-vercel-cron' en producción
    const isVercelCron = req.headers['x-vercel-cron'] === '1';
    const authHeader = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET || process.env.DOLIBARR_WEBHOOK_SECRET;
    
    // En producción, validar que viene de Vercel o tiene secret
    if (process.env.NODE_ENV === 'production') {
        if (!isVercelCron && cronSecret) {
            // Si no es de Vercel, validar con secret
            if (authHeader !== `Bearer ${cronSecret}`) {
                return res.status(401).json({ 
                    error: 'Unauthorized',
                    message: 'Este endpoint solo puede ser llamado por Vercel Cron o con secret válido'
                });
            }
        } else if (!isVercelCron && !cronSecret) {
            // En producción sin secret, solo permitir desde Vercel
            return res.status(401).json({ 
                error: 'Unauthorized',
                message: 'CRON_SECRET no configurado. Solo Vercel Cron puede llamar este endpoint.'
            });
        }
    }

    try {
        console.log('🔄 [CRON] Iniciando sincronización desde Dolibarr...');
        
        const result = await dolibarrService.syncAllProductsFromDolibarr(db, {
            onlyNew: false,
            updateStock: true,
            limit: null
        });

        console.log(`✅ [CRON] Sincronización completada: ${result.successCount} exitosos, ${result.errorCount} errores`);

        return res.status(200).json({
            success: true,
            message: 'Sincronización completada',
            data: {
                total: result.total,
                successCount: result.successCount,
                errorCount: result.errorCount,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ [CRON] Error en sincronización:', error);
        
        return res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    } finally {
        // No cerrar la conexión en serverless, se maneja automáticamente
    }
};

