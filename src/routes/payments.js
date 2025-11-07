const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validateCheckoutSession } = require('../middleware/validation');
const { stripe, getSuccessUrl, getCancelUrl } = require('../services/stripeService');

const router = express.Router();

router.post('/checkout', authenticateToken, validateCheckoutSession, async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { order_id, success_url, cancel_url } = req.body;
        const orderId = Number(order_id);
        if (!Number.isInteger(orderId) || orderId < 1) {
            return res.status(400).json({
                success: false,
                error: 'ID de orden inválido',
            });
        }

        const orderResult = await db.query(`
            SELECT 
                o.id,
                o.order_number,
                o.total,
                o.subtotal,
                o.tax_amount,
                o.shipping_amount,
                o.discount_amount,
                o.currency,
                o.payment_status,
                o.stripe_checkout_session_id,
                o.stripe_payment_intent_id,
                json_agg(
                    json_build_object(
                        'id', oi.id,
                        'product_id', oi.product_id,
                        'quantity', oi.quantity,
                        'price', oi.price,
                        'total', oi.total,
                        'name', p.name,
                        'sku', p.sku
                    )
                ) FILTER (WHERE oi.id IS NOT NULL) AS items
            FROM orders o
            LEFT JOIN order_items oi ON oi.order_id = o.id
            LEFT JOIN products p ON p.id = oi.product_id
            WHERE o.id = $1 AND o.user_id = $2
            GROUP BY o.id
        `, [orderId, userId]);

        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Orden no encontrada',
            });
        }

        const order = orderResult.rows[0];

        if (!order.items || order.items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'La orden no tiene productos asociados',
            });
        }

        if (order.payment_status === 'succeeded') {
            return res.status(400).json({
                success: false,
                error: 'La orden ya fue pagada',
            });
        }

        const currency = (order.currency || 'mxn').toLowerCase();
        const lineItems = order.items.map((item) => ({
            quantity: item.quantity,
            price_data: {
                currency,
                unit_amount: Math.round(parseFloat(item.price) * 100),
                product_data: {
                    name: item.name,
                    metadata: {
                        product_id: item.product_id,
                        sku: item.sku,
                    },
                },
            },
        }));

        const checkoutSession = await stripe.checkout.sessions.create({
            mode: 'payment',
            customer_email: req.user.email,
            line_items: lineItems,
            success_url: success_url || getSuccessUrl(),
            cancel_url: cancel_url || getCancelUrl(),
            metadata: {
                order_id: order.id,
                order_number: order.order_number,
                user_id: userId,
            },
            payment_intent_data: {
                metadata: {
                    order_id: order.id,
                    order_number: order.order_number,
                    user_id: userId,
                },
            },
        });

        await db.query(`
            UPDATE orders
            SET 
                stripe_checkout_session_id = $1,
                stripe_payment_intent_id = $2,
                payment_status = $3,
                currency = $4,
                payment_details = COALESCE(payment_details, '{}'::jsonb) || $5::jsonb,
                updated_at = NOW()
            WHERE id = $6
        `, [
            checkoutSession.id,
            checkoutSession.payment_intent,
            'requires_payment_method',
            currency,
            JSON.stringify({
                checkout_session: checkoutSession.id,
                payment_intent: checkoutSession.payment_intent,
                url: checkoutSession.url,
            }),
            order.id,
        ]);

        res.status(201).json({
            success: true,
            data: {
                checkoutSessionId: checkoutSession.id,
                url: checkoutSession.url,
            },
            message: 'Checkout Session creada exitosamente',
        });
    } catch (error) {
        console.error('Error al crear checkout session:', error);
        
        if (error.type === 'StripeInvalidRequestError' || error.message?.includes('Invalid API Key')) {
            return res.status(500).json({
                success: false,
                error: 'Error de configuración del sistema de pagos. Por favor, contacta al administrador.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
        
        if (error.type === 'StripeAuthenticationError') {
            return res.status(500).json({
                success: false,
                error: 'Error de autenticación con el sistema de pagos. Por favor, contacta al administrador.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
        
        next(error);
    }
});

module.exports = router;

