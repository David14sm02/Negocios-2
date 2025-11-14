/**
 * Script para sincronizar INMEDIATAMENTE desde Dolibarr
 * Útil cuando creas un producto y no quieres esperar 15 minutos
 * 
 * Uso: node scripts/sync-ahora.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

const db = require('../src/config/database');
const dolibarrService = require('../src/services/dolibarrService');

async function sincronizarAhora() {
    try {
        console.log('🚀 Sincronizando AHORA desde Dolibarr...\n');
        console.log('⏱️  No necesitas esperar 15 minutos, esto se ejecuta inmediatamente\n');

        const result = await dolibarrService.syncAllProductsFromDolibarr(db, {
            onlyNew: false,  // Sincronizar todos
            updateStock: true,
            limit: null
        });

        console.log('\n📊 RESULTADO:');
        console.log(`   ✅ Total procesados: ${result.total}`);
        console.log(`   ✅ Exitosos: ${result.successCount}`);
        console.log(`   ⚠️  Errores: ${result.errorCount}`);

        if (result.errors.length > 0) {
            console.log('\n❌ Errores encontrados:');
            result.errors.slice(0, 5).forEach(err => {
                console.log(`   - ${err.product}: ${err.error}`);
            });
        }

        console.log('\n✅ Sincronización completada. Los productos ya deberían estar en el e-commerce.');
        console.log('💡 Puedes refrescar el catálogo en: http://localhost:3000/catalog.html\n');

    } catch (error) {
        console.error('❌ Error en sincronización:', error);
        throw error;
    } finally {
        await db.close();
    }
}

// Ejecutar
sincronizarAhora()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    });

