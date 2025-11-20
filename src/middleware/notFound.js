// Middleware para manejar rutas no encontradas
const notFound = (req, res, next) => {
    // Ignorar rutas comunes que no necesitan error
    if (req.originalUrl === '/favicon.ico' || 
        req.originalUrl.startsWith('/.well-known/')) {
        return res.status(404).json({
            success: false,
            error: 'Recurso no encontrado'
        });
    }
    
    const error = new Error(`Ruta no encontrada - ${req.originalUrl}`);
    res.status(404);
    next(error);
};

module.exports = notFound;
