const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'config.env') });
const db = require('../../src/config/database');

async function up() {
    console.log('🔄 Actualizando columna products.image_url a tipo TEXT...');
    await db.query(`
        ALTER TABLE products
        ALTER COLUMN image_url TYPE TEXT
    `);
    console.log('✅ Columna image_url actualizada a TEXT.');
}

async function down() {
    console.log('🔁 Revirtiendo columna products.image_url a VARCHAR(500)...');
    await db.query(`
        ALTER TABLE products
        ALTER COLUMN image_url TYPE VARCHAR(500)
    `);
    console.log('✅ Columna image_url revertida a VARCHAR(500).');
}

async function run() {
    try {
        await up();
    } catch (error) {
        console.error('❌ Error ejecutando la migración:', error);
        process.exitCode = 1;
    } finally {
        await db.close();
    }
}

if (require.main === module) {
    run();
}

module.exports = { up, down };

