/**
 * Rutas para integración con Dolibarr ERP
 */

const express = require('express');
const router = express.Router();
const dolibarrService = require('../services/dolibarrService');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET /api/dolibarr/test - Probar conexión con Dolibarr
router.get('/test', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const result = await dolibarrService.testConnection();
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// POST /api/dolibarr/sync/customer/:userId - Sincronizar cliente con Dolibarr
router.post('/sync/customer/:userId', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const { userId } = req.params;
        
        const userResult = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado'
            });
        }
        
        const result = await dolibarrService.syncCustomer(userResult.rows[0]);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// POST /api/dolibarr/sync/product/:productId - Sincronizar producto con Dolibarr
router.post('/sync/product/:productId', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const { productId } = req.params;
        
        const productResult = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
        if (productResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }
        
        const result = await dolibarrService.syncProduct(productResult.rows[0]);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// POST /api/dolibarr/sync/order/:orderId - Sincronizar orden con Dolibarr
router.post('/sync/order/:orderId', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const { orderId } = req.params;
        
        // Obtener orden completa con items
        const orderResult = await db.query(`
            SELECT 
                o.*,
                json_agg(
                    json_build_object(
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
            WHERE o.id = $1
            GROUP BY o.id
        `, [orderId]);
        
        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Orden no encontrada'
            });
        }
        
        const order = orderResult.rows[0];
        const result = await dolibarrService.syncOrder(order, db);
        
        res.json({
            success: true,
            message: 'Orden sincronizada exitosamente con Dolibarr',
            data: result
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/dolibarr/products - Obtener productos de Dolibarr
router.get('/products', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const result = await dolibarrService.getProducts();
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /api/dolibarr/customers - Obtener clientes de Dolibarr
router.get('/customers', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const result = await dolibarrService.getCustomers();
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /api/dolibarr/orders - Obtener órdenes de Dolibarr
router.get('/orders', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const result = await dolibarrService.getOrders();
        res.json(result);
    } catch (error) {
        next(error);
    }
});

module.exports = router;

