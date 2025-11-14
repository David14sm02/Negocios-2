/**
 * Script de polling para sincronizar productos desde Dolibarr
 * Ejecutar periódicamente (cada 5-15 minutos) para detectar cambios
 * 
 * Uso:
 *   node scripts/sync-from-dolibarr-polling.js
 * 
 * O configurar como cron job:
 *   */15 * * * * cd /ruta/proyecto && node scripts/sync-from-dolibarr-polling.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

const db = require('../src/config/database');
const dolibarrService = require('../src/services/dolibarrService');

async function syncFromDolibarr() {
    try {
        console.log('🔄 Iniciando sincronización desde Dolibarr (polling)...\n');

        // Opciones de sincronización
        const options = {
            onlyNew: false,  // Sincronizar todos los productos (no solo nuevos)
            updateStock: true,
            limit: null  // Sin límite
        };

        const result = await dolibarrService.syncAllProductsFromDolibarr(db, options);

        console.log('\n📊 Resumen de sincronización:');
        console.log(`   - Total procesados: ${result.total}`);
        console.log(`   - Exitosos: ${result.successCount}`);
        console.log(`   - Errores: ${result.errorCount}`);

        if (result.errors.length > 0) {
            console.log('\n❌ Errores encontrados:');
            result.errors.slice(0, 10).forEach(err => {
                console.log(`   - ${err.product}: ${err.error}`);
            });
            if (result.errors.length > 10) {
                console.log(`   ... y ${result.errors.length - 10} errores más`);
            }
        }

        console.log('\n✅ Sincronización completada\n');

        return result;
    } catch (error) {
        console.error('❌ Error en sincronización desde Dolibarr:', error);
        throw error;
    } finally {
        await db.close();
    }
}

// Ejecutar sincronización
if (require.main === module) {
    syncFromDolibarr()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Error fatal:', error);
            process.exit(1);
        });
}

module.exports = { syncFromDolibarr };

