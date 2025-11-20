const express = require('express');
const db = require('../config/database');
const { validateOrder, validateId } = require('../middleware/validation');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const requireDatabase = require('../middleware/requireDatabase');
const dolibarrService = require('../services/dolibarrService');
const { stripe, extractReceiptUrl } = require('../services/stripeService');

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
router.post('/', authenticateToken, requireDatabase, validateOrder, async (req, res, next) => {
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

        // Preparar datos completos de la orden para sincronización
        const orderWithItems = {
            ...result,
            items: orderItems.map(item => ({
                product_id: item.product_id,
                product_name: productsMap[item.product_id].name,
                product_sku: productsMap[item.product_id].sku,
                quantity: item.quantity,
                price: item.price,
                total: item.total
            }))
        };

        // Sincronizar con Dolibarr antes de responder (para funciones serverless)
        if (process.env.DOLIBARR_URL && process.env.DOLIBARR_AUTO_SYNC !== 'false') {
            try {
                await dolibarrService.syncOrder(orderWithItems, db);
            } catch (error) {
                console.error('⚠️ Error sincronizando orden con Dolibarr (no crítico):', error.message);
            }
        }

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
router.get('/', authenticateToken, requireDatabase, async (req, res, next) => {
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
                o.receipt_url,
                o.invoice_pdf,
                o.stripe_checkout_session_id,
                o.stripe_payment_intent_id,
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
                     o.payment_method, o.payment_status, o.notes, o.receipt_url,
                     o.invoice_pdf, o.stripe_checkout_session_id, o.stripe_payment_intent_id,
                     o.created_at, o.updated_at
            ORDER BY o.created_at DESC
            LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
        `, [...queryParams, parseInt(limit), offset]);

        // Verificar y actualizar estados de pago automáticamente para TODOS los pedidos con Stripe
        if (stripe && result.rows.length > 0) {
            await Promise.all(result.rows.map(async (order) => {
                // Solo verificar pedidos que tengan IDs de Stripe
                if (!order.stripe_checkout_session_id && !order.stripe_payment_intent_id) {
                    return;
                }

                try {
                    let isPaymentSucceeded = false;
                    let invoicePdf = null;
                    let receiptUrl = null;

                    // Verificar desde checkout session
                    if (order.stripe_checkout_session_id) {
                        try {
                            const session = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id, {
                                expand: ['payment_intent.latest_charge', 'invoice']
                            });

                            // Si el pago es exitoso en Stripe
                            if (session.payment_status === 'paid' || session.status === 'complete') {
                                isPaymentSucceeded = true;

                                // Obtener factura
                                if (session.invoice) {
                                    const invoice = typeof session.invoice === 'string'
                                        ? await stripe.invoices.retrieve(session.invoice)
                                        : session.invoice;
                                    invoicePdf = invoice?.invoice_pdf || null;
                                }

                                // Obtener recibo
                                if (session.payment_intent) {
                                    const paymentIntent = typeof session.payment_intent === 'string'
                                        ? await stripe.paymentIntents.retrieve(session.payment_intent, {
                                            expand: ['latest_charge']
                                        })
                                        : session.payment_intent;
                                    receiptUrl = extractReceiptUrl(paymentIntent);
                                }
                            }
                        } catch (error) {
                            console.warn(`Error verificando checkout session:`, error.message);
                        }
                    }

                    // Verificar desde payment intent si aún no se confirmó
                    if (!isPaymentSucceeded && order.stripe_payment_intent_id) {
                        try {
                            const paymentIntent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id, {
                                expand: ['latest_charge']
                            });

                            if (paymentIntent.status === 'succeeded') {
                                isPaymentSucceeded = true;
                                receiptUrl = extractReceiptUrl(paymentIntent);
                            }
                        } catch (error) {
                            console.warn(`Error verificando payment intent:`, error.message);
                        }
                    }

                    // Si el pago es exitoso, actualizar la orden
                    if (isPaymentSucceeded) {
                        const updates = [];
                        const values = [];
                        let paramCount = 1;

                        updates.push(`payment_status = $${paramCount++}`);
                        values.push('succeeded');

                        if (order.status === 'pending') {
                            updates.push(`status = $${paramCount++}`);
                            values.push('processing');
                        }

                        // Si no hay factura de Stripe, crear URL para generar factura
                        if (!invoicePdf) {
                            // Crear URL del endpoint de factura
                            invoicePdf = `/api/orders/${order.id}/invoice`;
                        } else {
                            updates.push(`invoice_pdf = $${paramCount++}`);
                            values.push(invoicePdf);
                        }

                        if (receiptUrl) {
                            updates.push(`receipt_url = $${paramCount++}`);
                            values.push(receiptUrl);
                        }

                        if (updates.length > 0) {
                            updates.push(`updated_at = NOW()`);
                            values.push(order.id);

                            await db.query(
                                `UPDATE orders SET ${updates.join(', ')} WHERE id = $${paramCount}`,
                                values
                            );

                            // Actualizar en memoria
                            order.payment_status = 'succeeded';
                            if (order.status === 'pending') {
                                order.status = 'processing';
                            }
                            // Siempre asignar invoice_pdf (ya sea de Stripe o URL del endpoint)
                            order.invoice_pdf = invoicePdf;
                            if (receiptUrl) {
                                order.receipt_url = receiptUrl;
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`Error sincronizando pedido ${order.id}:`, error.message);
                }
            }));
        }

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
router.get('/:id', authenticateToken, requireDatabase, validateId, async (req, res, next) => {
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
router.put('/:id/cancel', authenticateToken, requireDatabase, validateId, async (req, res, next) => {
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

        // Obtener información de los items antes de cancelar (para sincronización con Dolibarr)
        const itemsResult = await db.query(`
            SELECT 
                oi.product_id, 
                oi.quantity,
                p.sku,
                p.name
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = $1
        `, [id]);

        // Cancelar orden y restaurar stock
        await db.transaction(async (client) => {
            // Actualizar estado de la orden
            await client.query(
                'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
                ['cancelled', id]
            );

            // Restaurar stock de productos
            for (const item of itemsResult.rows) {
                await client.query(`
                    UPDATE products 
                    SET stock = stock + $1, updated_at = NOW()
                    WHERE id = $2
                `, [item.quantity, item.product_id]);
            }
        });

        // Sincronizar cancelación con Dolibarr antes de responder
        if (process.env.DOLIBARR_URL && process.env.DOLIBARR_AUTO_SYNC !== 'false') {
            try {
                // Obtener productos actualizados con stock restaurado después de la transacción
                const updatedProductsResult = await db.query(`
                    SELECT id, sku, name, stock 
                    FROM products 
                    WHERE id = ANY($1)
                `, [itemsResult.rows.map(item => item.product_id)]);
                
                const cancellationData = {
                    items: itemsResult.rows.map(item => {
                        const updatedProduct = updatedProductsResult.rows.find(p => p.id === item.product_id);
                        return {
                            product_id: item.product_id,
                            product_sku: item.sku,
                            product_name: item.name,
                            quantity: item.quantity,
                            current_stock: updatedProduct ? updatedProduct.stock : null
                        };
                    })
                };
                
                await dolibarrService.syncOrderCancellation(cancellationData, db);
            } catch (error) {
                console.error('⚠️ Error sincronizando cancelación con Dolibarr (no crítico):', error.message);
            }
        }

        res.json({
            success: true,
            message: 'Orden cancelada exitosamente'
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/orders/admin/all - Obtener todas las órdenes (Admin)
router.get('/admin/all', authenticateToken, requireAdmin, requireDatabase, async (req, res, next) => {
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

// POST /api/orders/admin/sync-all-stripe - Sincronizar todos los pedidos con Stripe (Admin)
router.post('/admin/sync-all-stripe', authenticateToken, requireAdmin, requireDatabase, async (req, res, next) => {
    try {
        if (!stripe) {
            return res.status(500).json({
                success: false,
                error: 'Stripe no está configurado'
            });
        }

        // Obtener todos los pedidos con IDs de Stripe
        const ordersResult = await db.query(`
            SELECT 
                id, 
                order_number, 
                status, 
                payment_status,
                stripe_checkout_session_id,
                stripe_payment_intent_id,
                invoice_pdf,
                receipt_url
            FROM orders
            WHERE (stripe_checkout_session_id IS NOT NULL OR stripe_payment_intent_id IS NOT NULL)
            ORDER BY created_at DESC
        `);

        const orders = ordersResult.rows;
        
        if (orders.length === 0) {
            return res.json({
                success: true,
                message: 'No se encontraron pedidos con información de Stripe',
                data: {
                    total: 0,
                    updated: 0,
                    succeeded: 0,
                    invoiceFound: 0,
                    errors: 0,
                    skipped: 0
                }
            });
        }

        const results = {
            total: orders.length,
            updated: 0,
            succeeded: 0,
            invoiceFound: 0,
            errors: 0,
            skipped: 0,
            errors_detail: []
        };

        // Procesar cada pedido (con límite para no sobrecargar)
        const limit = parseInt(req.body.limit) || 100; // Procesar máximo 100 a la vez
        const ordersToProcess = orders.slice(0, limit);

        for (const order of ordersToProcess) {
            try {
                let paymentStatus = null;
                let invoicePdf = null;
                let receiptUrl = null;
                let amountPaid = null;
                let shouldUpdateStatus = null;

                // Intentar obtener información desde checkout session
                if (order.stripe_checkout_session_id) {
                    try {
                        const session = await stripe.checkout.sessions.retrieve(
                            order.stripe_checkout_session_id,
                            { expand: ['payment_intent.latest_charge', 'invoice'] }
                        );

                        if (session.payment_status === 'paid') {
                            paymentStatus = 'succeeded';
                            if (order.status === 'pending') {
                                shouldUpdateStatus = 'processing';
                            }
                        }

                        if (session.amount_total != null) {
                            amountPaid = session.amount_total / 100;
                        }

                        // Intentar obtener factura
                        if (session.invoice) {
                            const invoice = typeof session.invoice === 'string'
                                ? await stripe.invoices.retrieve(session.invoice)
                                : session.invoice;
                            
                            if (invoice?.invoice_pdf) {
                                invoicePdf = invoice.invoice_pdf;
                            } else if (invoice?.status === 'paid' || invoice?.status === 'open') {
                                // Intentar finalizar factura si está pagada pero no tiene PDF
                                try {
                                    const finalizedInvoice = await stripe.invoices.finalizeInvoice(
                                        typeof session.invoice === 'string' ? session.invoice : session.invoice.id
                                    );
                                    if (finalizedInvoice?.invoice_pdf) {
                                        invoicePdf = finalizedInvoice.invoice_pdf;
                                    }
                                } catch (finalizeError) {
                                    // Ignorar si ya está finalizada
                                }
                            }
                        }

                        // Intentar obtener recibo desde payment intent
                        if (session.payment_intent) {
                            const paymentIntent = typeof session.payment_intent === 'string'
                                ? await stripe.paymentIntents.retrieve(session.payment_intent, {
                                    expand: ['latest_charge']
                                })
                                : session.payment_intent;
                            receiptUrl = extractReceiptUrl(paymentIntent);
                        }
                    } catch (error) {
                        // Continuar con el siguiente método
                    }
                }

                // Si no se pudo obtener desde checkout session, intentar desde payment intent
                if (!paymentStatus && order.stripe_payment_intent_id) {
                    try {
                        const paymentIntent = await stripe.paymentIntents.retrieve(
                            order.stripe_payment_intent_id,
                            { expand: ['latest_charge'] }
                        );

                        if (paymentIntent.status === 'succeeded') {
                            paymentStatus = 'succeeded';
                            if (order.status === 'pending') {
                                shouldUpdateStatus = 'processing';
                            }
                            receiptUrl = extractReceiptUrl(paymentIntent);
                            if (paymentIntent.amount_received != null) {
                                amountPaid = paymentIntent.amount_received / 100;
                            }
                        }
                    } catch (error) {
                        // Continuar
                    }
                }

                // Si se encontró un estado de pago exitoso, actualizar la orden
                if (paymentStatus === 'succeeded') {
                    const needsUpdate = 
                        order.payment_status !== 'succeeded' ||
                        (shouldUpdateStatus && order.status === 'pending') ||
                        (invoicePdf && order.invoice_pdf !== invoicePdf) ||
                        (receiptUrl && order.receipt_url !== receiptUrl);

                    if (!needsUpdate && order.payment_status === 'succeeded') {
                        results.skipped++;
                        continue;
                    }

                    const updateFields = [];
                    const updateValues = [];
                    let paramCount = 1;

                    updateFields.push(`payment_status = $${paramCount++}`);
                    updateValues.push('succeeded');

                    if (shouldUpdateStatus && order.status === 'pending') {
                        updateFields.push(`status = $${paramCount++}`);
                        updateValues.push(shouldUpdateStatus);
                    }

                    if (amountPaid != null) {
                        updateFields.push(`amount_paid = $${paramCount++}`);
                        updateValues.push(amountPaid);
                    }

                    if (receiptUrl && order.receipt_url !== receiptUrl) {
                        updateFields.push(`receipt_url = COALESCE(receipt_url, $${paramCount++})`);
                        updateValues.push(receiptUrl);
                    }

                    if (invoicePdf && order.invoice_pdf !== invoicePdf) {
                        updateFields.push(`invoice_pdf = COALESCE(invoice_pdf, $${paramCount++})`);
                        updateValues.push(invoicePdf);
                    }

                    updateFields.push(`updated_at = NOW()`);
                    updateValues.push(order.id);

                    await db.query(
                        `UPDATE orders SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
                        updateValues
                    );

                    results.updated++;
                    results.succeeded++;
                    if (invoicePdf) {
                        results.invoiceFound++;
                    }
                } else {
                    results.skipped++;
                }
            } catch (error) {
                results.errors++;
                results.errors_detail.push({
                    order_number: order.order_number,
                    error: error.message
                });
            }
        }

        return res.json({
            success: true,
            message: `Sincronización completada. Procesados ${ordersToProcess.length} de ${orders.length} pedidos.`,
            data: {
                ...results,
                processed: ordersToProcess.length,
                remaining: orders.length - ordersToProcess.length
            }
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/orders/confirm-payment - Confirmar pago manual (fallback)
router.post('/confirm-payment', authenticateToken, requireDatabase, async (req, res, next) => {
    const { session_id: sessionId } = req.body || {};

    if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'session_id es requerido'
        });
    }

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['payment_intent.latest_charge', 'invoice']
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Sesión de pago no encontrada'
            });
        }

        const orderId = session.metadata?.order_id ? parseInt(session.metadata.order_id, 10) : null;
        if (!orderId) {
            return res.status(400).json({
                success: false,
                error: 'La sesión de pago no contiene información de la orden'
            });
        }

        const userId = req.user.id;
        if (session.metadata?.user_id && parseInt(session.metadata.user_id, 10) !== userId) {
            return res.status(403).json({
                success: false,
                error: 'No tienes permisos para confirmar esta orden'
            });
        }

        let paymentIntent = session.payment_intent;
        if (!paymentIntent) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo obtener el Payment Intent asociado'
            });
        }

        if (typeof paymentIntent === 'string') {
            paymentIntent = await stripe.paymentIntents.retrieve(paymentIntent, {
                expand: ['latest_charge']
            });
        }

        const receiptUrl = extractReceiptUrl(paymentIntent);
        let invoicePdf = null;

        // Intentar obtener la factura desde la sesión
        if (session.invoice) {
            const invoice = typeof session.invoice === 'string'
                ? await stripe.invoices.retrieve(session.invoice)
                : session.invoice;
            invoicePdf = invoice?.invoice_pdf || null;
        }

        // Si no hay factura en la sesión, intentar obtenerla desde el payment intent
        if (!invoicePdf && paymentIntent?.invoice) {
            try {
                const invoiceId = typeof paymentIntent.invoice === 'string' 
                    ? paymentIntent.invoice 
                    : paymentIntent.invoice.id;
                const invoice = await stripe.invoices.retrieve(invoiceId);
                invoicePdf = invoice?.invoice_pdf || null;
            } catch (invoiceError) {
                console.warn('No se pudo obtener factura desde payment intent:', invoiceError.message);
            }
        }

        // Mapear payment_status correctamente
        let paymentStatus = session.payment_status;
        if (paymentStatus === 'paid') {
            paymentStatus = 'succeeded';
        } else if (paymentIntent?.status === 'succeeded') {
            paymentStatus = 'succeeded';
        } else {
            paymentStatus = paymentIntent?.status || session.payment_status || 'processing';
        }

        // Si el pago es exitoso, actualizar estado del pedido
        const shouldUpdateStatus = (paymentStatus === 'succeeded' || session.payment_status === 'paid') ? 'processing' : null;
        
        // Asegurar que payment_status sea 'succeeded' para pagos exitosos
        if (session.payment_status === 'paid' || paymentIntent?.status === 'succeeded') {
            paymentStatus = 'succeeded';
        }
        const amountPaid = session.amount_total != null
            ? session.amount_total / 100
            : (paymentIntent?.amount_received ?? 0) / 100;
        const currency = (session.currency || paymentIntent?.currency || 'mxn').toLowerCase();

        const paymentDetails = {
            checkout_session: session.id,
            payment_intent: paymentIntent?.id || null,
            payment_status: session.payment_status,
            payment_method: paymentIntent?.payment_method || null,
            receipt_url: receiptUrl || null
        };

        const updateResult = await db.query(`
            UPDATE orders
            SET 
                payment_status = $1,
                status = CASE WHEN $2 IS NOT NULL AND status = 'pending' THEN $2 ELSE status END,
                amount_paid = COALESCE($3, amount_paid),
                currency = $4,
                receipt_url = COALESCE($5, receipt_url),
                invoice_pdf = COALESCE($6, invoice_pdf),
                stripe_checkout_session_id = COALESCE(stripe_checkout_session_id, $7),
                stripe_payment_intent_id = COALESCE(stripe_payment_intent_id, $8),
                payment_details = COALESCE(payment_details, '{}'::jsonb) || $9::jsonb,
                updated_at = NOW()
            WHERE id = $10 AND user_id = $11
            RETURNING id
        `, [
            paymentStatus,
            shouldUpdateStatus,
            amountPaid || null,
            currency,
            receiptUrl || null,
            invoicePdf || null,
            session.id,
            paymentIntent?.id || null,
            JSON.stringify(paymentDetails),
            orderId,
            userId
        ]);

        if (updateResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Orden no encontrada o no pertenece al usuario'
            });
        }

        const orderResult = await db.query(`
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
                o.receipt_url,
                o.invoice_pdf,
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
            WHERE o.id = $1 AND o.user_id = $2
            GROUP BY o.id, o.order_number, o.status, o.total, o.subtotal, 
                     o.tax_amount, o.shipping_amount, o.discount_amount,
                     o.payment_method, o.payment_status, o.notes, o.receipt_url,
                     o.invoice_pdf, o.created_at, o.updated_at
        `, [orderId, userId]);

        res.json({
            success: true,
            data: {
                order: orderResult.rows[0] || null
            }
        });
    } catch (error) {
        if (error?.raw?.message) {
            console.error('Stripe error al confirmar pago:', error.raw.message);
        }
        next(error);
    }
});

// POST /api/orders/sync-payment-status - Sincronizar estado de pago desde Stripe (Admin o mismo usuario)
router.post('/sync-payment-status', authenticateToken, requireDatabase, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { order_id: orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                error: 'order_id es requerido'
            });
        }

        // Obtener la orden
        const orderResult = await db.query(
            `SELECT id, user_id, order_number, status, payment_status, 
                    stripe_checkout_session_id, stripe_payment_intent_id
             FROM orders 
             WHERE id = $1`,
            [orderId]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Orden no encontrada'
            });
        }

        const order = orderResult.rows[0];

        // Verificar que el usuario tenga permiso (mismo usuario o admin)
        if (order.user_id !== userId && !req.user.is_admin) {
            return res.status(403).json({
                success: false,
                error: 'No tienes permisos para sincronizar esta orden'
            });
        }

        // Si no hay IDs de Stripe, no se puede sincronizar
        if (!order.stripe_checkout_session_id && !order.stripe_payment_intent_id) {
            return res.status(400).json({
                success: false,
                error: 'La orden no tiene información de Stripe para sincronizar'
            });
        }

        let paymentStatus = null;
        let invoicePdf = null;
        let receiptUrl = null;
        let amountPaid = null;
        let shouldUpdateStatus = null;

        // Intentar obtener información desde checkout session
        if (order.stripe_checkout_session_id) {
            try {
                const session = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id, {
                    expand: ['payment_intent.latest_charge', 'invoice']
                });

                if (session.payment_status === 'paid') {
                    paymentStatus = 'succeeded';
                    if (order.status === 'pending') {
                        shouldUpdateStatus = 'processing';
                    }
                }

                if (session.amount_total != null) {
                    amountPaid = session.amount_total / 100;
                }

                // Intentar obtener factura
                if (session.invoice) {
                    const invoice = typeof session.invoice === 'string'
                        ? await stripe.invoices.retrieve(session.invoice)
                        : session.invoice;
                    invoicePdf = invoice?.invoice_pdf || null;
                }

                // Intentar obtener recibo desde payment intent
                if (session.payment_intent) {
                    const paymentIntent = typeof session.payment_intent === 'string'
                        ? await stripe.paymentIntents.retrieve(session.payment_intent, {
                            expand: ['latest_charge']
                        })
                        : session.payment_intent;
                    receiptUrl = extractReceiptUrl(paymentIntent);
                }
            } catch (error) {
                console.warn('Error obteniendo checkout session:', error.message);
            }
        }

        // Si no se pudo obtener desde checkout session, intentar desde payment intent
        if (!paymentStatus && order.stripe_payment_intent_id) {
            try {
                const paymentIntent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id, {
                    expand: ['latest_charge']
                });

                if (paymentIntent.status === 'succeeded') {
                    paymentStatus = 'succeeded';
                    if (order.status === 'pending') {
                        shouldUpdateStatus = 'processing';
                    }
                    receiptUrl = extractReceiptUrl(paymentIntent);
                    if (paymentIntent.amount_received != null) {
                        amountPaid = paymentIntent.amount_received / 100;
                    }
                }
            } catch (error) {
                console.warn('Error obteniendo payment intent:', error.message);
            }
        }

        // Si se encontró un estado de pago exitoso, actualizar la orden
        if (paymentStatus === 'succeeded') {
            const updateFields = [];
            const updateValues = [];
            let paramCount = 1;

            updateFields.push(`payment_status = $${paramCount++}`);
            updateValues.push('succeeded');

            if (shouldUpdateStatus) {
                updateFields.push(`status = $${paramCount++}`);
                updateValues.push(shouldUpdateStatus);
            }

            if (amountPaid != null) {
                updateFields.push(`amount_paid = $${paramCount++}`);
                updateValues.push(amountPaid);
            }

            if (receiptUrl) {
                updateFields.push(`receipt_url = COALESCE(receipt_url, $${paramCount++})`);
                updateValues.push(receiptUrl);
            }

            if (invoicePdf) {
                updateFields.push(`invoice_pdf = COALESCE(invoice_pdf, $${paramCount++})`);
                updateValues.push(invoicePdf);
            }

            updateFields.push(`updated_at = NOW()`);
            updateValues.push(orderId);

            await db.query(
                `UPDATE orders SET ${updateFields.join(', ')} WHERE id = $${paramCount}`,
                updateValues
            );

            return res.json({
                success: true,
                message: 'Estado de pago sincronizado exitosamente',
                data: {
                    payment_status: 'succeeded',
                    status: shouldUpdateStatus || order.status,
                    invoice_pdf: invoicePdf,
                    receipt_url: receiptUrl
                }
            });
        } else {
            return res.json({
                success: true,
                message: 'La orden no tiene un pago exitoso en Stripe',
                data: {
                    payment_status: order.payment_status,
                    status: order.status
                }
            });
        }
    } catch (error) {
        next(error);
    }
});

// GET /api/orders/:id/invoice - Generar y descargar factura del pedido
router.get('/:id/invoice', authenticateToken, requireDatabase, validateId, async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Obtener la orden con información de Stripe
        const orderResult = await db.query(`
            SELECT 
                o.*,
                o.stripe_checkout_session_id,
                o.stripe_payment_intent_id,
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
                ) FILTER (WHERE oi.id IS NOT NULL) as items,
                json_build_object(
                    'id', u.id,
                    'email', u.email,
                    'first_name', u.first_name,
                    'last_name', u.last_name,
                    'phone', u.phone,
                    'address', u.address,
                    'city', u.city,
                    'state', u.state,
                    'postal_code', u.postal_code,
                    'country', u.country
                ) as user
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.id
            LEFT JOIN users u ON o.user_id = u.id
            WHERE o.id = $1 AND o.user_id = $2
            GROUP BY o.id, u.id, o.stripe_checkout_session_id, o.stripe_payment_intent_id
        `, [id, userId]);

        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Orden no encontrada'
            });
        }

        const order = orderResult.rows[0];

        // Verificar que el pago sea exitoso
        if (order.payment_status !== 'succeeded') {
            return res.status(400).json({
                success: false,
                error: 'La factura solo está disponible para pagos exitosos'
            });
        }

        // Si ya hay una factura PDF de Stripe, redirigir a ella
        if (order.invoice_pdf && order.invoice_pdf.startsWith('http')) {
            return res.redirect(order.invoice_pdf);
        }

        // Intentar obtener factura de Stripe si existe
        let stripeInvoicePdf = null;
        if (order.stripe_checkout_session_id && stripe) {
            try {
                const session = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id, {
                    expand: ['invoice', 'payment_intent']
                });

                // Buscar factura en la sesión
                if (session.invoice) {
                    const invoice = typeof session.invoice === 'string'
                        ? await stripe.invoices.retrieve(session.invoice)
                        : session.invoice;
                    
                    if (invoice?.invoice_pdf) {
                        stripeInvoicePdf = invoice.invoice_pdf;
                    }
                }

                // Si no hay factura en la sesión, buscar en el payment intent
                if (!stripeInvoicePdf && session.payment_intent) {
                    const paymentIntent = typeof session.payment_intent === 'string'
                        ? await stripe.paymentIntents.retrieve(session.payment_intent, {
                            expand: ['invoice']
                        })
                        : session.payment_intent;
                    
                    if (paymentIntent?.invoice) {
                        const invoice = typeof paymentIntent.invoice === 'string'
                            ? await stripe.invoices.retrieve(paymentIntent.invoice)
                            : paymentIntent.invoice;
                        
                        if (invoice?.invoice_pdf) {
                            stripeInvoicePdf = invoice.invoice_pdf;
                        }
                    }
                }

                // Si encontramos factura de Stripe, actualizar y redirigir
                if (stripeInvoicePdf) {
                    await db.query(
                        `UPDATE orders SET invoice_pdf = $1 WHERE id = $2`,
                        [stripeInvoicePdf, order.id]
                    );
                    return res.redirect(stripeInvoicePdf);
                }
            } catch (error) {
                console.warn('Error obteniendo factura de Stripe:', error.message);
            }
        }

        // Generar factura HTML como fallback
        const invoiceHTML = generateInvoiceHTML(order);
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `inline; filename="factura-${order.order_number}.html"`);
        res.send(invoiceHTML);
    } catch (error) {
        next(error);
    }
});

// Función para generar HTML de factura
function generateInvoiceHTML(order) {
    const items = Array.isArray(order.items) ? order.items : [];
    const user = order.user || {};
    const fecha = new Date(order.created_at).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const itemsHTML = items.map(item => `
        <tr>
            <td>${item.product_name || 'Producto'}</td>
            <td>${item.product_sku || 'N/A'}</td>
            <td style="text-align: right;">${item.quantity || 0}</td>
            <td style="text-align: right;">$${parseFloat(item.price || 0).toFixed(2)}</td>
            <td style="text-align: right;">$${parseFloat(item.total || 0).toFixed(2)}</td>
        </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Factura ${order.order_number}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #333;
        }
        .invoice-header {
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .company-info {
            margin-bottom: 20px;
        }
        .invoice-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
        }
        .client-info, .invoice-details {
            flex: 1;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f3f4f6;
            font-weight: bold;
        }
        .totals {
            margin-left: auto;
            width: 300px;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
        }
        .total-row.final {
            font-size: 1.2em;
            font-weight: bold;
            border-top: 2px solid #2563eb;
            margin-top: 10px;
            padding-top: 10px;
        }
        @media print {
            body { margin: 0; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="invoice-header">
        <h1>NetTech Solutions</h1>
        <p>Factura Electrónica</p>
    </div>
    
    <div class="invoice-info">
        <div class="client-info">
            <h3>Cliente:</h3>
            <p><strong>${user.first_name || ''} ${user.last_name || ''}</strong></p>
            <p>${user.email || ''}</p>
            ${user.address ? `<p>${user.address}</p>` : ''}
            ${user.city || user.state ? `<p>${user.city || ''}${user.city && user.state ? ', ' : ''}${user.state || ''}</p>` : ''}
        </div>
        <div class="invoice-details">
            <h3>Datos de la Factura:</h3>
            <p><strong>Número de Orden:</strong> ${order.order_number || ''}</p>
            <p><strong>Fecha:</strong> ${fecha}</p>
            <p><strong>Estado:</strong> Pagado</p>
        </div>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>Producto</th>
                <th>SKU</th>
                <th style="text-align: right;">Cantidad</th>
                <th style="text-align: right;">Precio Unitario</th>
                <th style="text-align: right;">Total</th>
            </tr>
        </thead>
        <tbody>
            ${itemsHTML}
        </tbody>
    </table>
    
    <div class="totals">
        <div class="total-row">
            <span>Subtotal:</span>
            <span>$${parseFloat(order.subtotal || 0).toFixed(2)}</span>
        </div>
        ${parseFloat(order.tax_amount || 0) > 0 ? `
        <div class="total-row">
            <span>IVA (16%):</span>
            <span>$${parseFloat(order.tax_amount || 0).toFixed(2)}</span>
        </div>
        ` : ''}
        ${parseFloat(order.shipping_amount || 0) > 0 ? `
        <div class="total-row">
            <span>Envío:</span>
            <span>$${parseFloat(order.shipping_amount || 0).toFixed(2)}</span>
        </div>
        ` : ''}
        <div class="total-row final">
            <span>Total:</span>
            <span>$${parseFloat(order.total || 0).toFixed(2)}</span>
        </div>
    </div>
    
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 0.9em; color: #666;">
        <p><strong>NetTech Solutions</strong></p>
        <p>Esta es una factura electrónica. Puede guardarla o imprimirla para sus registros.</p>
        <p class="no-print">Presione Ctrl+P para imprimir esta factura</p>
    </div>
</body>
</html>`;
}

// PUT /api/orders/:id/status - Actualizar estado de orden (Admin)
router.put('/:id/status', authenticateToken, requireAdmin, requireDatabase, validateId, async (req, res, next) => {
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
