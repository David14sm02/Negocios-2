const express = require('express');
const db = require('../config/database');
const { validateOrder, validateId } = require('../middleware/validation');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Función para generar número de orden único
const generateOrderNumber = () => {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD-${timestamp}-${random}`;
};

// Función para calcular totales de la orden
const calculateOrderTotals = (items) => {
    const subtotal = items.reduce((total, item) => total + (item.price * item.quantity), 0);
    const taxRate = 0.16; // 16% IVA
    const taxAmount = subtotal * taxRate;
    const shippingAmount = subtotal > 1000 ? 0 : 150; // Envío gratis sobre $1000
    const total = subtotal + taxAmount + shippingAmount;

    return {
        subtotal: parseFloat(subtotal.toFixed(2)),
        taxAmount: parseFloat(taxAmount.toFixed(2)),
        shippingAmount: parseFloat(shippingAmount.toFixed(2)),
        total: parseFloat(total.toFixed(2))
    };
};

// POST /api/orders - Crear nueva orden
router.post('/', authenticateToken, validateOrder, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { items, shipping_address, billing_address, payment_method, notes } = req.body;

        // Verificar que todos los productos existen y están disponibles
        const productIds = items.map(item => item.product_id);
        const productsResult = await db.query(`
            SELECT id, name, price, stock, sku
            FROM products 
            WHERE id = ANY($1) AND is_active = true
        `, [productIds]);

        if (productsResult.rows.length !== productIds.length) {
            return res.status(400).json({
                success: false,
                error: 'Uno o más productos no están disponibles'
            });
        }

        const productsMap = {};
        productsResult.rows.forEach(product => {
            productsMap[product.id] = product;
        });

        // Verificar stock y preparar items con precios actuales
        const orderItems = [];
        for (const item of items) {
            const product = productsMap[item.product_id];
            
            if (product.stock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    error: `Stock insuficiente para ${product.name}. Disponible: ${product.stock} unidades`
                });
            }

            orderItems.push({
                product_id: product.id,
                quantity: item.quantity,
                price: parseFloat(product.price),
                total: parseFloat(product.price) * item.quantity
            });
        }

        // Calcular totales
        const totals = calculateOrderTotals(orderItems);

        // Generar número de orden
        const orderNumber = generateOrderNumber();

        // Crear orden en transacción
        const result = await db.transaction(async (client) => {
            // Crear la orden
            const orderResult = await client.query(`
                INSERT INTO orders (
                    user_id, order_number, status, total, subtotal, tax_amount,
                    shipping_amount, discount_amount, shipping_address, billing_address,
                    payment_method, payment_status, notes
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *
            `, [
                userId, orderNumber, 'pending', totals.total, totals.subtotal,
                totals.taxAmount, totals.shippingAmount, 0,
                JSON.stringify(shipping_address), JSON.stringify(billing_address),
                payment_method, 'pending', notes
            ]);

            const order = orderResult.rows[0];

            // Crear items de la orden
            for (const item of orderItems) {
                await client.query(`
                    INSERT INTO order_items (order_id, product_id, quantity, price, total)
                    VALUES ($1, $2, $3, $4, $5)
                `, [order.id, item.product_id, item.quantity, item.price, item.total]);

                // Actualizar stock
                await client.query(`
                    UPDATE products 
                    SET stock = stock - $1, updated_at = NOW()
                    WHERE id = $2
                `, [item.quantity, item.product_id]);
            }

            return order;
        });

        res.status(201).json({
            success: true,
            data: {
                order: result,
                items: orderItems,
                totals
            },
            message: 'Orden creada exitosamente'
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/orders - Obtener órdenes del usuario autenticado
router.get('/', authenticateToken, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 10, status } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE o.user_id = $1';
        let queryParams = [userId];
        let paramCount = 1;

        if (status) {
            paramCount++;
            whereClause += ` AND o.status = $${paramCount}`;
            queryParams.push(status);
        }

        const result = await db.query(`
            SELECT 
                o.id,
                o.order_number,
                o.status,
                o.total,
                o.subtotal,
                o.tax_amount,
                o.shipping_amount,
                o.discount_amount,
                o.payment_method,
                o.payment_status,
                o.notes,
                o.created_at,
                o.updated_at,
                json_agg(
                    json_build_object(
                        'id', oi.id,
                        'product_id', oi.product_id,
                        'product_name', p.name,
                        'product_sku', p.sku,
                        'quantity', oi.quantity,
                        'price', oi.price,
                        'total', oi.total
                    )
                ) FILTER (WHERE oi.id IS NOT NULL) as items
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.id
            ${whereClause}
            GROUP BY o.id, o.order_number, o.status, o.total, o.subtotal, 
                     o.tax_amount, o.shipping_amount, o.discount_amount,
                     o.payment_method, o.payment_status, o.notes, o.created_at, o.updated_at
            ORDER BY o.created_at DESC
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `, [...queryParams, parseInt(limit), offset]);

        const countResult = await db.query(`
            SELECT COUNT(*) as total FROM orders o ${whereClause}
        `, queryParams);

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / limit);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages
            }
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/orders/:id - Obtener orden específica
router.get('/:id', authenticateToken, validateId, async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const result = await db.query(`
            SELECT 
                o.*,
                json_agg(
                    json_build_object(
                        'id', oi.id,
                        'product_id', oi.product_id,
                        'product_name', p.name,
                        'product_sku', p.sku,
                        'product_image', p.image_url,
                        'quantity', oi.quantity,
                        'price', oi.price,
                        'total', oi.total
                    )
                ) FILTER (WHERE oi.id IS NOT NULL) as items
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE o.id = $1 AND o.user_id = $2
            GROUP BY o.id
        `, [id, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Orden no encontrada'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
});

// PUT /api/orders/:id/cancel - Cancelar orden
router.put('/:id/cancel', authenticateToken, validateId, async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Verificar que la orden existe y pertenece al usuario
        const orderResult = await db.query(
            'SELECT id, status FROM orders WHERE id = $1 AND user_id = $2',
            [id, userId]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Orden no encontrada'
            });
        }

        const order = orderResult.rows[0];

        if (order.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                error: 'La orden ya está cancelada'
            });
        }

        if (order.status === 'shipped' || order.status === 'delivered') {
            return res.status(400).json({
                success: false,
                error: 'No se puede cancelar una orden que ya ha sido enviada'
            });
        }

        // Cancelar orden y restaurar stock
        await db.transaction(async (client) => {
            // Actualizar estado de la orden
            await client.query(
                'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
                ['cancelled', id]
            );

            // Restaurar stock de productos
            const itemsResult = await client.query(
                'SELECT product_id, quantity FROM order_items WHERE order_id = $1',
                [id]
            );

            for (const item of itemsResult.rows) {
                await client.query(`
                    UPDATE products 
                    SET stock = stock + $1, updated_at = NOW()
                    WHERE id = $2
                `, [item.quantity, item.product_id]);
            }
        });

        res.json({
            success: true,
            message: 'Orden cancelada exitosamente'
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/orders/admin/all - Obtener todas las órdenes (Admin)
router.get('/admin/all', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const { page = 1, limit = 20, status, search } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = '';
        let queryParams = [];
        let paramCount = 0;

        const conditions = [];
        
        if (status) {
            paramCount++;
            conditions.push(`o.status = $${paramCount}`);
            queryParams.push(status);
        }

        if (search) {
            paramCount++;
            conditions.push(`(o.order_number ILIKE $${paramCount} OR u.email ILIKE $${paramCount} OR u.first_name ILIKE $${paramCount})`);
            queryParams.push(`%${search}%`);
        }

        if (conditions.length > 0) {
            whereClause = `WHERE ${conditions.join(' AND ')}`;
        }

        const result = await db.query(`
            SELECT 
                o.id,
                o.order_number,
                o.status,
                o.total,
                o.subtotal,
                o.tax_amount,
                o.shipping_amount,
                o.payment_method,
                o.payment_status,
                o.created_at,
                o.updated_at,
                json_build_object(
                    'id', u.id,
                    'email', u.email,
                    'first_name', u.first_name,
                    'last_name', u.last_name,
                    'phone', u.phone
                ) as user
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            ${whereClause}
            ORDER BY o.created_at DESC
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `, [...queryParams, parseInt(limit), offset]);

        const countResult = await db.query(`
            SELECT COUNT(*) as total 
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            ${whereClause}
        `, queryParams);

        const total = parseInt(countResult.rows[0].total);
        const totalPages = Math.ceil(total / limit);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages
            }
        });
    } catch (error) {
        next(error);
    }
});

// PUT /api/orders/:id/status - Actualizar estado de orden (Admin)
router.put('/:id/status', authenticateToken, requireAdmin, validateId, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Estado de orden inválido'
            });
        }

        const result = await db.query(`
            UPDATE orders 
            SET status = $1, updated_at = NOW()
            WHERE id = $2
            RETURNING id, order_number, status
        `, [status, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Orden no encontrada'
            });
        }

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Estado de orden actualizado exitosamente'
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
