const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });
const db = require('../src/config/database');

async function initializeDatabase() {
    try {
        console.log('🚀 Inicializando base de datos...');
        
        // Probar conexión
        await db.testConnection();
        console.log('✅ Conexión establecida');
        
        // Crear tablas
        await db.createTables();
        console.log('✅ Tablas creadas');
        
        // Insertar datos iniciales
        await db.seedData();
        console.log('✅ Datos iniciales insertados');
        
        console.log('🎉 Base de datos inicializada exitosamente');
        
    } catch (error) {
        console.error('❌ Error al inicializar la base de datos:', error);
        process.exit(1);
    } finally {
        await db.close();
        process.exit(0);
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    initializeDatabase();
}

module.exports = initializeDatabase;
