// Handler para Vercel Serverless Functions
// Usar try-catch para manejar errores de inicialización
let app;

try {
    app = require('../src/server');
} catch (error) {
    console.error('❌ Error al cargar el servidor:', error);
    // Crear un app mínimo en caso de error
    const express = require('express');
    app = express();
    app.use((req, res) => {
        res.status(500).json({
            error: 'Error al inicializar el servidor',
            message: error.message
        });
    });
}

// Exportar como handler para Vercel
module.exports = app;
