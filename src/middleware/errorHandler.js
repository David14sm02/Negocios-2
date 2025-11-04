// Middleware para manejo de errores
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log del error
    console.error('❌ Error:', err);

    // Error de validación de PostgreSQL
    if (err.code === '23505') {
        const message = 'Recurso duplicado';
        error = { message, statusCode: 400 };
    }

    // Error de clave foránea
    if (err.code === '23503') {
        const message = 'Referencia a recurso inexistente';
        error = { message, statusCode: 400 };
    }

    // Error de validación de datos
    if (err.code === '23514') {
        const message = 'Datos inválidos';
        error = { message, statusCode: 400 };
    }

    // Error de sintaxis SQL
    if (err.code === '42601') {
        const message = 'Error de sintaxis en la consulta';
        error = { message, statusCode: 500 };
    }

    // Error de conexión a la base de datos
    if (err.code === 'ECONNREFUSED') {
        const message = 'Error de conexión a la base de datos';
        error = { message, statusCode: 503 };
    }

    res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Error interno del servidor',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

module.exports = errorHandler;
