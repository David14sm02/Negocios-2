const db = require('../config/database');

/**
 * Middleware para verificar que la base de datos esté disponible
 * Devuelve 503 Service Unavailable si la base de datos no está configurada
 */
const requireDatabase = (req, res, next) => {
    if (!db.isAvailable()) {
        return res.status(503).json({
            success: false,
            error: 'Base de datos no disponible. Por favor, configura DATABASE_URL en config.env'
        });
    }
    next();
};

module.exports = requireDatabase;

