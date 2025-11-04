const express = require('express');
const db = require('../config/database');
const { validateCartItem, validateId, validateProductId } = require('../middleware/validation');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Función helper para parsear JSON de forma segura
const safeJsonParse = (jsonData, defaultValue = []) => {
    try {
        // Si ya es un objeto/array, devolverlo tal como está
        if (typeof jsonData === 'object' && jsonData !== null) {
            return jsonData;
        }
        // Si es string, parsearlo
        if (typeof jsonData === 'string') {
            return JSON.parse(jsonData || '[]');
        }
        return defaultValue;
    } catch (error) {
        console.error('Error parsing JSON:', error);
        return defaultValue;
    }
};

// Función para obtener o crear sesión de carrito
const getOrCreateCartSession = async (sessionId, userId = null) => {
    let result = await db.query(
        'SELECT * FROM cart_sessions WHERE session_id = $1',
        [sessionId]
    );

    if (result.rows.length === 0) {
        result = await db.query(`
            INSERT INTO cart_sessions (session_id, user_id, items, total)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [sessionId, userId, '[]', 0]);
    }

    return result.rows[0];
};

// Función para calcular total del carrito
const calculateCartTotal = (items) => {
    return items.reduce((total, item) => {
        return total + (item.price * item.quantity);
    }, 0);
};

// Función para actualizar carrito en la base de datos
const updateCartInDB = async (sessionId, items, total) => {
    await db.query(`
        UPDATE cart_sessions 
        SET items = $1, total = $2, updated_at = NOW()
        WHERE session_id = $3
    `, [JSON.stringify(items), total, sessionId]);
};

// GET /api/cart - Obtener carrito del usuario
router.get('/', optionalAuth, async (req, res, next) => {
    try {
        const sessionId = req.headers['x-session-id'] || req.sessionID || 'anonymous';
        const userId = req.user ? req.user.id : null;

        const cartSession = await getOrCreateCartSession(sessionId, userId);
        console.log('🔍 Debug cartSession.items:', cartSession.items);
        console.log('🔍 Debug cartSession.items type:', typeof cartSession.items);
        const items = safeJsonParse(cartSession.items);
        console.log('🔍 Debug parsed items:', items);

        // Obtener información completa de los productos
        if (items.length > 0) {
            const productIds = items.map(item => item.product_id);
            const productsResult = await db.query(`
                SELECT id, name, price, sku, stock, image_url, is_active
                FROM products 
                WHERE id = ANY($1) AND is_active = true
            `, [productIds]);

            const productsMap = {};
            productsResult.rows.forEach(product => {
                productsMap[product.id] = product;
            });

            // Filtrar items que ya no existen o están inactivos
            const validItems = items.filter(item => {
                const product = productsMap[item.product_id];
                if (!product) return false;
                
                // Actualizar información del producto
                item.name = product.name;
                item.sku = product.sku;
                item.image_url = product.image_url;
                item.stock = product.stock;
                
                return true;
            });

            // Actualizar carrito si hay cambios
            if (validItems.length !== items.length) {
                const newTotal = calculateCartTotal(validItems);
                await updateCartInDB(sessionId, validItems, newTotal);
                cartSession.items = JSON.stringify(validItems);
                cartSession.total = newTotal;
            }
        }

        res.json({
            success: true,
            data: {
                items: items,
                total: parseFloat(cartSession.total),
                itemCount: items.reduce((count, item) => count + item.quantity, 0)
            }
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/cart/add - Agregar producto al carrito
router.post('/add', optionalAuth, validateCartItem, async (req, res, next) => {
    try {
        const { product_id, quantity } = req.body;
        const sessionId = req.headers['x-session-id'] || req.sessionID || 'anonymous';
        const userId = req.user ? req.user.id : null;

        // Verificar que el producto existe y está disponible
        const productResult = await db.query(`
            SELECT id, name, price, sku, stock, image_url
            FROM products 
            WHERE id = $1 AND is_active = true
        `, [product_id]);

        if (productResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

        const product = productResult.rows[0];

        // Verificar stock disponible
        if (product.stock < quantity) {
            return res.status(400).json({
                success: false,
                error: `Stock insuficiente. Disponible: ${product.stock} unidades`
            });
        }

        // Obtener o crear sesión de carrito
        const cartSession = await getOrCreateCartSession(sessionId, userId);
        let items = safeJsonParse(cartSession.items);

        // Verificar si el producto ya está en el carrito (manejar comparación de tipos)
        const productIdNum = parseInt(product_id);
        const existingItemIndex = items.findIndex(item => {
            const itemProductId = parseInt(item.product_id);
            return itemProductId === productIdNum;
        });

        if (existingItemIndex >= 0) {
            // Actualizar cantidad
            const newQuantity = items[existingItemIndex].quantity + quantity;
            
            if (newQuantity > product.stock) {
                return res.status(400).json({
                    success: false,
                    error: `Stock insuficiente. Disponible: ${product.stock} unidades`
                });
            }
            
            items[existingItemIndex].quantity = newQuantity;
        } else {
            // Agregar nuevo item
            items.push({
                product_id: product.id,
                name: product.name,
                sku: product.sku,
                price: parseFloat(product.price),
                quantity: quantity,
                image_url: product.image_url
            });
        }

        const total = calculateCartTotal(items);
        await updateCartInDB(sessionId, items, total);

        res.json({
            success: true,
            data: {
                items,
                total,
                itemCount: items.reduce((count, item) => count + item.quantity, 0)
            },
            message: 'Producto agregado al carrito'
        });
    } catch (error) {
        next(error);
    }
});

// PUT /api/cart/update - Actualizar cantidad de un producto
router.put('/update', optionalAuth, validateCartItem, async (req, res, next) => {
    try {
        const { product_id, quantity } = req.body;
        const sessionId = req.headers['x-session-id'] || req.sessionID || 'anonymous';

        if (quantity <= 0) {
            return res.status(400).json({
                success: false,
                error: 'La cantidad debe ser mayor a 0'
            });
        }

        // Verificar stock disponible
        const productResult = await db.query(`
            SELECT stock FROM products WHERE id = $1 AND is_active = true
        `, [product_id]);

        if (productResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

        const availableStock = productResult.rows[0].stock;
        if (availableStock < quantity) {
            return res.status(400).json({
                success: false,
                error: `Stock insuficiente. Disponible: ${availableStock} unidades`
            });
        }

        // Obtener carrito actual
        const cartSession = await getOrCreateCartSession(sessionId);
        let items = safeJsonParse(cartSession.items);

        // Buscar y actualizar el item (manejar comparación de tipos)
        const productIdNum = parseInt(product_id);
        const itemIndex = items.findIndex(item => {
            const itemProductId = parseInt(item.product_id);
            return itemProductId === productIdNum;
        });
        
        if (itemIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado en el carrito'
            });
        }

        items[itemIndex].quantity = quantity;
        const total = calculateCartTotal(items);
        await updateCartInDB(sessionId, items, total);

        res.json({
            success: true,
            data: {
                items,
                total,
                itemCount: items.reduce((count, item) => count + item.quantity, 0)
            },
            message: 'Cantidad actualizada'
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/cart/remove/:product_id - Remover producto del carrito
router.delete('/remove/:product_id', optionalAuth, validateProductId, async (req, res, next) => {
    try {
        const { product_id } = req.params;
        const sessionId = req.headers['x-session-id'] || req.sessionID || 'anonymous';

        // Obtener carrito actual
        const cartSession = await getOrCreateCartSession(sessionId);
        let items = safeJsonParse(cartSession.items);

        // Filtrar el producto (manejar comparación de tipos)
        const productIdNum = parseInt(product_id);
        const filteredItems = items.filter(item => {
            const itemProductId = parseInt(item.product_id);
            return itemProductId !== productIdNum;
        });
        
        if (filteredItems.length === items.length) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado en el carrito'
            });
        }

        const total = calculateCartTotal(filteredItems);
        await updateCartInDB(sessionId, filteredItems, total);

        res.json({
            success: true,
            data: {
                items: filteredItems,
                total,
                itemCount: filteredItems.reduce((count, item) => count + item.quantity, 0)
            },
            message: 'Producto removido del carrito'
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/cart/clear - Limpiar carrito
router.delete('/clear', optionalAuth, async (req, res, next) => {
    try {
        const sessionId = req.headers['x-session-id'] || req.sessionID || 'anonymous';

        await updateCartInDB(sessionId, [], 0);

        res.json({
            success: true,
            data: {
                items: [],
                total: 0,
                itemCount: 0
            },
            message: 'Carrito limpiado'
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/cart/count - Obtener cantidad de items en el carrito
router.get('/count', optionalAuth, async (req, res, next) => {
    try {
        const sessionId = req.headers['x-session-id'] || req.sessionID || 'anonymous';

        const cartSession = await getOrCreateCartSession(sessionId);
        const items = safeJsonParse(cartSession.items);
        const itemCount = items.reduce((count, item) => count + item.quantity, 0);

        res.json({
            success: true,
            data: { itemCount }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
