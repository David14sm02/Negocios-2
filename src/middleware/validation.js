const { body, param, query, validationResult } = require('express-validator');

// Middleware para manejar errores de validación
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: 'Datos de entrada inválidos',
            details: errors.array()
        });
    }
    next();
};

// Validaciones para productos
const validateProduct = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 255 })
        .withMessage('El nombre debe tener entre 2 y 255 caracteres'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage('La descripción no puede exceder 2000 caracteres'),
    body('price')
        .isFloat({ min: 0 })
        .withMessage('El precio debe ser un número positivo'),
    body('category_id')
        .isInt({ min: 1 })
        .withMessage('Debe seleccionar una categoría válida'),
    body('sku')
        .trim()
        .isLength({ min: 3, max: 100 })
        .withMessage('El SKU debe tener entre 3 y 100 caracteres'),
    body('stock')
        .optional()
        .isInt({ min: 0 })
        .withMessage('El stock debe ser un número entero no negativo'),
    body('brand')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('La marca no puede exceder 100 caracteres'),
    handleValidationErrors
];

// Validaciones para usuarios
const validateUser = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Debe proporcionar un email válido'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('first_name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    body('last_name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('El apellido debe tener entre 2 y 100 caracteres'),
    body('phone')
        .optional()
        .trim()
        .isLength({ min: 10, max: 20 })
        .withMessage('El teléfono debe tener entre 10 y 20 caracteres'),
    handleValidationErrors
];

// Validaciones para órdenes
const validateOrder = [
    body('items')
        .isArray({ min: 1 })
        .withMessage('Debe incluir al menos un producto'),
    body('items.*.product_id')
        .isInt({ min: 1 })
        .withMessage('ID de producto inválido'),
    body('items.*.quantity')
        .isInt({ min: 1 })
        .withMessage('La cantidad debe ser al menos 1'),
    body('shipping_address')
        .optional()
        .isObject()
        .withMessage('La dirección de envío debe ser un objeto válido'),
    body('billing_address')
        .optional()
        .isObject()
        .withMessage('La dirección de facturación debe ser un objeto válido'),
    handleValidationErrors
];

// Validaciones para parámetros de ID
const validateId = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('ID inválido'),
    handleValidationErrors
];

// Validación para product_id en parámetros
const validateProductId = [
    param('product_id')
        .isInt({ min: 1 })
        .withMessage('ID de producto inválido'),
    handleValidationErrors
];

// Validaciones para consultas de búsqueda
const validateSearch = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('La página debe ser un número entero positivo'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('El límite debe estar entre 1 y 100'),
    query('sort')
        .optional()
        .isIn(['name', 'price', 'created_at', 'stock'])
        .withMessage('Campo de ordenamiento inválido'),
    query('order')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Orden inválido (asc o desc)'),
    handleValidationErrors
];

// Validaciones para carrito
const validateCartItem = [
    body('product_id')
        .isInt({ min: 1 })
        .withMessage('ID de producto inválido'),
    body('quantity')
        .isInt({ min: 1 })
        .withMessage('La cantidad debe ser al menos 1'),
    handleValidationErrors
];

const validateCheckoutSession = [
    body('order_id')
        .toInt()
        .isInt({ min: 1 })
        .withMessage('ID de orden inválido'),
    body('success_url')
        .optional()
        .isString()
        .trim()
        .customSanitizer(value => (value && value.length > 0 ? value : undefined)),
    body('cancel_url')
        .optional()
        .isString()
        .trim()
        .customSanitizer(value => (value && value.length > 0 ? value : undefined)),
    handleValidationErrors
];

module.exports = {
    validateProduct,
    validateUser,
    validateOrder,
    validateId,
    validateProductId,
    validateSearch,
    validateCartItem,
    validateCheckoutSession,
    handleValidationErrors
};
