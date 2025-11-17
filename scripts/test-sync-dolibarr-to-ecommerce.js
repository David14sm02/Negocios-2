/**
 * Script de prueba para verificar la sincronización desde Dolibarr al E-commerce
 * 
 * Este script:
 * 1. Verifica la conexión con Dolibarr
 * 2. Obtiene productos de Dolibarr
 * 3. Sincroniza productos al e-commerce
 * 4. Verifica que los productos aparezcan en la base de datos
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

const db = require('../src/config/database');
const dolibarrService = require('../src/services/dolibarrService');

async function testSync() {
    console.log('🧪 Iniciando prueba de sincronización Dolibarr → E-commerce\n');
    console.log('='.repeat(60));

    try {
        // 1. Verificar conexión a la base de datos
        console.log('\n📊 Paso 1: Verificando conexión a la base de datos...');
        await db.testConnection();
        console.log('✅ Conexión a la base de datos establecida\n');

        // 2. Verificar conexión con Dolibarr
        console.log('🔗 Paso 2: Verificando conexión con Dolibarr...');
        console.log(`   URL: ${process.env.DOLIBARR_URL}`);
        console.log(`   Usuario: ${process.env.DOLIBARR_API_USER}`);
        
        const testConnection = await dolibarrService.getProducts({ limit: 1 });
        if (testConnection.success) {
            console.log('✅ Conexión con Dolibarr establecida\n');
        } else {
            throw new Error('No se pudo conectar con Dolibarr');
        }

        // 3. Obtener productos de Dolibarr
        console.log('📦 Paso 3: Obteniendo productos de Dolibarr...');
        const dolibarrProducts = await dolibarrService.getProducts();
        
        if (!dolibarrProducts.success || !Array.isArray(dolibarrProducts.data)) {
            throw new Error('No se pudieron obtener productos de Dolibarr');
        }

        console.log(`   Total de productos en Dolibarr: ${dolibarrProducts.data.length}`);
        
        if (dolibarrProducts.data.length === 0) {
            console.log('⚠️  No hay productos en Dolibarr para sincronizar');
            console.log('💡 Crea un producto en Dolibarr primero y vuelve a ejecutar este script');
            process.exit(0);
        }

        // Mostrar algunos productos
        console.log('\n   Primeros productos en Dolibarr:');
        dolibarrProducts.data.slice(0, 3).forEach((product, index) => {
            console.log(`   ${index + 1}. ${product.label || product.ref} (ID: ${product.id}, Ref: ${product.ref || 'N/A'})`);
        });
        console.log('');

        // 4. Verificar productos existentes en e-commerce
        console.log('🔍 Paso 4: Verificando productos existentes en e-commerce...');
        const existingProducts = await db.query(`
            SELECT COUNT(*) as total, 
                   COUNT(CASE WHEN dolibarr_id IS NOT NULL THEN 1 END) as synced
            FROM products
        `);
        
        console.log(`   Total de productos en e-commerce: ${existingProducts.rows[0].total}`);
        console.log(`   Productos sincronizados desde Dolibarr: ${existingProducts.rows[0].synced}\n`);

        // 5. Sincronizar productos (solo los nuevos para la prueba)
        console.log('🔄 Paso 5: Sincronizando productos desde Dolibarr...');
        console.log('   (Sincronizando solo productos nuevos para esta prueba)\n');
        
        const syncResult = await dolibarrService.syncAllProductsFromDolibarr(db, {
            onlyNew: true,  // Solo productos nuevos
            updateStock: true,
            limit: null
        });

        console.log('\n📊 Resultados de la sincronización:');
        console.log(`   ✅ Total procesados: ${syncResult.total}`);
        console.log(`   ✅ Sincronizados exitosamente: ${syncResult.successCount}`);
        console.log(`   ❌ Errores: ${syncResult.errorCount}`);

        if (syncResult.errors.length > 0) {
            console.log('\n   Errores encontrados:');
            syncResult.errors.slice(0, 5).forEach((error, index) => {
                console.log(`   ${index + 1}. ${error.product}: ${error.error}`);
            });
            if (syncResult.errors.length > 5) {
                console.log(`   ... y ${syncResult.errors.length - 5} errores más`);
            }
        }

        // 6. Verificar productos sincronizados
        console.log('\n🔍 Paso 6: Verificando productos sincronizados en e-commerce...');
        const syncedProducts = await db.query(`
            SELECT id, name, sku, dolibarr_id, dolibarr_synced_at, stock
            FROM products 
            WHERE dolibarr_id IS NOT NULL 
            ORDER BY dolibarr_synced_at DESC 
            LIMIT 10
        `);

        console.log(`\n   Últimos ${syncedProducts.rows.length} productos sincronizados:`);
        syncedProducts.rows.forEach((product, index) => {
            console.log(`   ${index + 1}. ${product.name}`);
            console.log(`      SKU: ${product.sku || 'N/A'}`);
            console.log(`      ID Dolibarr: ${product.dolibarr_id}`);
            console.log(`      Stock: ${product.stock || 0}`);
            console.log(`      Sincronizado: ${product.dolibarr_synced_at || 'N/A'}`);
            console.log('');
        });

        // 7. Resumen final
        console.log('='.repeat(60));
        console.log('\n✅ PRUEBA COMPLETADA\n');
        
        if (syncResult.successCount > 0) {
            console.log(`✅ ${syncResult.successCount} producto(s) sincronizado(s) exitosamente`);
            console.log('✅ Los productos deberían aparecer en el catálogo del e-commerce');
            console.log('\n💡 Para verificar:');
            console.log('   1. Abre http://localhost:3000/catalog.html');
            console.log('   2. Los productos sincronizados deberían aparecer en el catálogo');
        } else {
            console.log('ℹ️  No se sincronizaron productos nuevos');
            console.log('   Esto puede significar que:');
            console.log('   - Todos los productos ya están sincronizados');
            console.log('   - O necesitas crear un producto nuevo en Dolibarr');
        }

        if (syncResult.errorCount > 0) {
            console.log(`\n⚠️  ${syncResult.errorCount} error(es) durante la sincronización`);
            console.log('   Revisa los errores arriba para más detalles');
        }

    } catch (error) {
        console.error('\n❌ ERROR EN LA PRUEBA:');
        console.error(`   ${error.message}`);
        console.error('\nStack trace:');
        console.error(error.stack);
        process.exit(1);
    } finally {
        // Cerrar conexión a la base de datos
        await db.close();
        console.log('\n🔒 Conexión a la base de datos cerrada');
    }
}

// Ejecutar prueba
testSync();


