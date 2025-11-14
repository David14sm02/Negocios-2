/**
 * Script para analizar la estructura de la base de datos
 * y determinar qué se necesita para sincronización bidireccional con Dolibarr
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

const db = require('../src/config/database');

async function analyzeDatabaseStructure() {
    try {
        console.log('🔍 Analizando estructura de la base de datos...\n');

        // 1. Analizar tabla products
        console.log('📦 TABLA: products');
        console.log('─'.repeat(60));
        const productsColumns = await db.query(`
            SELECT 
                column_name,
                data_type,
                character_maximum_length,
                is_nullable,
                column_default,
                character_set_name
            FROM information_schema.columns
            WHERE table_name = 'products'
            ORDER BY ordinal_position
        `);

        console.log('\nColumnas actuales:');
        productsColumns.rows.forEach(col => {
            const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
            const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
            const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
            console.log(`  - ${col.column_name}: ${col.data_type}${length} ${nullable}${defaultVal}`);
        });

        // Verificar si existen campos relacionados con Dolibarr
        const dolibarrColumns = productsColumns.rows.filter(col => 
            col.column_name.toLowerCase().includes('dolibarr')
        );

        console.log('\n✅ Campos relacionados con Dolibarr:');
        if (dolibarrColumns.length > 0) {
            dolibarrColumns.forEach(col => {
                console.log(`  ✓ ${col.column_name} (${col.data_type})`);
            });
        } else {
            console.log('  ❌ No se encontraron campos relacionados con Dolibarr');
        }

        // Verificar índices
        console.log('\n📑 Índices en tabla products:');
        const productsIndexes = await db.query(`
            SELECT 
                indexname,
                indexdef
            FROM pg_indexes
            WHERE tablename = 'products'
        `);
        productsIndexes.rows.forEach(idx => {
            console.log(`  - ${idx.indexname}`);
        });

        // 2. Analizar tabla integration_logs
        console.log('\n\n📋 TABLA: integration_logs');
        console.log('─'.repeat(60));
        const logsColumns = await db.query(`
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_name = 'integration_logs'
            ORDER BY ordinal_position
        `);

        console.log('\nColumnas actuales:');
        logsColumns.rows.forEach(col => {
            const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
            const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
            console.log(`  - ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
        });

        // 3. Verificar restricciones y foreign keys
        console.log('\n\n🔗 RESTRICCIONES Y FOREIGN KEYS');
        console.log('─'.repeat(60));
        const constraints = await db.query(`
            SELECT
                tc.constraint_name,
                tc.constraint_type,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            LEFT JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.table_name = 'products'
            ORDER BY tc.constraint_type, tc.constraint_name
        `);

        console.log('\nRestricciones en products:');
        constraints.rows.forEach(con => {
            if (con.constraint_type === 'FOREIGN KEY') {
                console.log(`  - ${con.constraint_name}: ${con.column_name} → ${con.foreign_table_name}.${con.foreign_column_name}`);
            } else if (con.constraint_type === 'CHECK') {
                console.log(`  - ${con.constraint_name}: CHECK constraint`);
            } else if (con.constraint_type === 'UNIQUE') {
                console.log(`  - ${con.constraint_name}: UNIQUE on ${con.column_name}`);
            } else if (con.constraint_type === 'PRIMARY KEY') {
                console.log(`  - ${con.constraint_name}: PRIMARY KEY on ${con.column_name}`);
            }
        });

        // 4. Verificar datos de ejemplo
        console.log('\n\n📊 DATOS DE EJEMPLO');
        console.log('─'.repeat(60));
        const sampleProducts = await db.query(`
            SELECT 
                id,
                name,
                sku,
                stock,
                is_active,
                created_at,
                updated_at
            FROM products
            LIMIT 3
        `);

        console.log('\nProductos de ejemplo:');
        sampleProducts.rows.forEach(prod => {
            console.log(`  - ID: ${prod.id}, SKU: ${prod.sku}, Stock: ${prod.stock}, Activo: ${prod.is_active}`);
        });

        // 5. Análisis de necesidades
        console.log('\n\n🎯 ANÁLISIS DE NECESIDADES');
        console.log('─'.repeat(60));
        console.log('\n❌ CAMPOS FALTANTES PARA SINCRONIZACIÓN BIDIRECCIONAL:');
        
        const requiredFields = [
            { name: 'dolibarr_id', type: 'INTEGER', nullable: true, description: 'ID del producto en Dolibarr' },
            { name: 'dolibarr_synced_at', type: 'TIMESTAMP', nullable: true, description: 'Última vez que se sincronizó con Dolibarr' },
            { name: 'sync_direction', type: 'VARCHAR(20)', nullable: false, default: "'outbound'", description: 'Dirección de sincronización (outbound/inbound/bidirectional)' },
            { name: 'last_sync_source', type: 'VARCHAR(50)', nullable: true, description: 'Última fuente que modificó el producto (ecommerce/dolibarr)' }
        ];

        const existingColumnNames = productsColumns.rows.map(c => c.column_name.toLowerCase());
        
        requiredFields.forEach(field => {
            if (!existingColumnNames.includes(field.name.toLowerCase())) {
                console.log(`  ❌ ${field.name} (${field.type}) - ${field.description}`);
            } else {
                console.log(`  ✅ ${field.name} - Ya existe`);
            }
        });

        // 6. Generar script de migración
        console.log('\n\n📝 SCRIPT DE MIGRACIÓN SUGERIDO:');
        console.log('─'.repeat(60));
        console.log('\n-- Agregar campos para sincronización bidireccional con Dolibarr\n');
        
        requiredFields.forEach(field => {
            if (!existingColumnNames.includes(field.name.toLowerCase())) {
                const nullable = field.nullable ? 'NULL' : 'NOT NULL';
                const defaultVal = field.default ? ` DEFAULT ${field.default}` : '';
                console.log(`ALTER TABLE products ADD COLUMN IF NOT EXISTS ${field.name} ${field.type} ${nullable}${defaultVal};`);
            }
        });

        console.log('\n-- Crear índices para mejorar rendimiento\n');
        console.log('CREATE INDEX IF NOT EXISTS idx_products_dolibarr_id ON products(dolibarr_id) WHERE dolibarr_id IS NOT NULL;');
        console.log('CREATE INDEX IF NOT EXISTS idx_products_dolibarr_synced_at ON products(dolibarr_synced_at);');
        console.log('CREATE INDEX IF NOT EXISTS idx_products_sync_direction ON products(sync_direction);');

        console.log('\n-- Agregar constraint para sync_direction\n');
        console.log(`ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sync_direction_check;`);
        console.log(`ALTER TABLE products ADD CONSTRAINT products_sync_direction_check CHECK (sync_direction IN ('outbound', 'inbound', 'bidirectional'));`);

        console.log('\n✅ Análisis completado\n');

    } catch (error) {
        console.error('❌ Error analizando base de datos:', error);
        throw error;
    } finally {
        await db.close();
    }
}

// Ejecutar análisis
analyzeDatabaseStructure()
    .then(() => {
        console.log('✅ Análisis finalizado exitosamente');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error en el análisis:', error);
        process.exit(1);
    });

