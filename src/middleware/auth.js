const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Middleware para autenticación JWT
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Token de acceso requerido'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Verificar que el usuario existe y está activo
        const userResult = await db.query(
            `SELECT 
                id,
                email,
                first_name,
                last_name,
                is_active,
                is_admin
            FROM users 
            WHERE id = $1`,
            [decoded.userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Usuario no encontrado'
            });
        }

        if (!userResult.rows[0].is_active) {
            return res.status(401).json({
                success: false,
                error: 'Usuario inactivo'
            });
        }

        req.user = userResult.rows[0];
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Token inválido'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expirado'
            });
        }

        return res.status(500).json({
            success: false,
            error: 'Error de autenticación'
        });
    }
};

// Middleware para verificar si es administrador
const requireAdmin = (req, res, next) => {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({
            success: false,
            error: 'Acceso denegado. Se requieren permisos de administrador.'
        });
    }
    next();
};

// Middleware opcional de autenticación (no falla si no hay token)
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userResult = await db.query(
                `SELECT 
                    id,
                    email,
                    first_name,
                    last_name,
                    is_active,
                    is_admin
                FROM users 
                WHERE id = $1`,
                [decoded.userId]
            );

            if (userResult.rows.length > 0 && userResult.rows[0].is_active) {
                req.user = userResult.rows[0];
            }
        }
        
        next();
    } catch (error) {
        // Si hay error con el token, simplemente continuamos sin usuario
        next();
    }
};

module.exports = {
    authenticateToken,
    requireAdmin,
    optionalAuth
};
