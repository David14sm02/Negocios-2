/**
 * Script para ejecutar la migración de sincronización bidireccional
 * Ejecuta el script SQL de migración de forma segura
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

const db = require('../src/config/database');

async function runMigration() {
    try {
        console.log('🚀 Iniciando migración de sincronización bidireccional...\n');

        // Ejecutar statements en orden específico
        const steps = [
            {
                name: 'Agregar columnas',
                statement: `ALTER TABLE products 
                    ADD COLUMN IF NOT EXISTS dolibarr_id INTEGER NULL,
                    ADD COLUMN IF NOT EXISTS dolibarr_synced_at TIMESTAMP NULL,
                    ADD COLUMN IF NOT EXISTS sync_direction VARCHAR(20) NOT NULL DEFAULT 'outbound',
                    ADD COLUMN IF NOT EXISTS last_sync_source VARCHAR(50) NULL`
            },
            {
                name: 'Crear índice dolibarr_id',
                statement: `CREATE INDEX IF NOT EXISTS idx_products_dolibarr_id 
                    ON products(dolibarr_id) 
                    WHERE dolibarr_id IS NOT NULL`
            },
            {
                name: 'Crear índice dolibarr_synced_at',
                statement: `CREATE INDEX IF NOT EXISTS idx_products_dolibarr_synced_at 
                    ON products(dolibarr_synced_at)`
            },
            {
                name: 'Crear índice sync_direction',
                statement: `CREATE INDEX IF NOT EXISTS idx_products_sync_direction 
                    ON products(sync_direction)`
            },
            {
                name: 'Crear índice last_sync_source',
                statement: `CREATE INDEX IF NOT EXISTS idx_products_last_sync_source 
                    ON products(last_sync_source)`
            },
            {
                name: 'Agregar constraint sync_direction',
                statement: `ALTER TABLE products 
                    DROP CONSTRAINT IF EXISTS products_sync_direction_check;
                    ALTER TABLE products 
                    ADD CONSTRAINT products_sync_direction_check 
                    CHECK (sync_direction IN ('outbound', 'inbound', 'bidirectional'))`
            },
            {
                name: 'Agregar constraint last_sync_source',
                statement: `ALTER TABLE products 
                    DROP CONSTRAINT IF EXISTS products_last_sync_source_check;
                    ALTER TABLE products 
                    ADD CONSTRAINT products_last_sync_source_check 
                    CHECK (last_sync_source IS NULL OR last_sync_source IN ('ecommerce', 'dolibarr'))`
            }
        ];

        console.log(`📝 Ejecutando ${steps.length} pasos...\n`);

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            
            try {
                console.log(`⏳ [${i + 1}/${steps.length}] ${step.name}...`);
                
                // Si el statement tiene múltiples comandos separados por ;, ejecutarlos por separado
                const statements = step.statement.split(';').map(s => s.trim()).filter(s => s.length > 0);
                
                for (const stmt of statements) {
                    await db.query(stmt);
                }
                
                console.log(`✅ ${step.name} completado\n`);
            } catch (error) {
                // Algunos errores son esperados (como "already exists")
                if (error.message.includes('already exists') || 
                    error.message.includes('does not exist') ||
                    error.message.includes('duplicate key')) {
                    console.log(`⚠️  ${step.name}: ${error.message}\n`);
                } else {
                    console.error(`❌ Error en ${step.name}:`, error.message);
                    throw error;
                }
            }
        }

        // Verificar migración
        console.log('🔍 Verificando migración...\n');
        const verification = await db.query(`
            SELECT 
                column_name, 
                data_type, 
                is_nullable, 
                column_default
            FROM information_schema.columns
            WHERE table_name = 'products' 
            AND column_name IN ('dolibarr_id', 'dolibarr_synced_at', 'sync_direction', 'last_sync_source')
            ORDER BY column_name
        `);

        console.log('✅ Columnas agregadas:');
        verification.rows.forEach(col => {
            console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });

        // Verificar índices
        const indexes = await db.query(`
            SELECT indexname
            FROM pg_indexes
            WHERE tablename = 'products'
            AND (indexname LIKE '%dolibarr%' OR indexname LIKE '%sync%')
        `);

        console.log('\n✅ Índices creados:');
        indexes.rows.forEach(idx => {
            console.log(`   - ${idx.indexname}`);
        });

        console.log('\n✅ Migración completada exitosamente!\n');

    } catch (error) {
        console.error('❌ Error en la migración:', error);
        throw error;
    } finally {
        await db.close();
    }
}

// Ejecutar migración
runMigration()
    .then(() => {
        console.log('✅ Proceso finalizado');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error fatal:', error);
        process.exit(1);
    });

