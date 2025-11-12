const db = require('../config/database');
const { constructWebhookEvent, extractReceiptUrl } = require('../services/stripeService');

const PAYMENT_STATUS_MAP = {
    'requires_payment_method': 'requires_payment_method',
    processing: 'processing',
    succeeded: 'succeeded',
    canceled: 'cancelled',
    failed: 'failed',
};

const logStripeEvent = async (event, { orderId = null, processed = false, error = null } = {}) => {
    try {
        const payload = JSON.stringify(event);
        await db.query(
            `INSERT INTO stripe_events (stripe_event_id, type, order_id, payload, processed, error, processed_at)
             VALUES ($1, $2, $3, $4::jsonb, $5, $6, CASE WHEN $5 THEN NOW() ELSE NULL END)
             ON CONFLICT (stripe_event_id)
             DO UPDATE SET
                 order_id = COALESCE(stripe_events.order_id, EXCLUDED.order_id),
                 payload = EXCLUDED.payload,
                 processed = EXCLUDED.processed,
                 error = EXCLUDED.error,
                 processed_at = CASE WHEN EXCLUDED.processed THEN NOW() ELSE stripe_events.processed_at END`,
            [event.id, event.type, orderId, payload, processed, error]
        );
    } catch (logError) {
        console.error('Error registrando evento de Stripe:', logError.message);
    }
};

const buildOrderUpdates = (eventType, payload, currentOrder) => {
    const updates = {};
    const mergeDetails = {};

    switch (eventType) {
        case 'checkout.session.completed':
            updates.payment_status = PAYMENT_STATUS_MAP[payload.payment_status] || 'processing';
            updates.stripe_checkout_session_id = payload.id;
            updates.stripe_payment_intent_id = payload.payment_intent;
            if (payload.amount_total != null) {
                updates.amount_paid = payload.amount_total / 100;
            }
            break;
        case 'payment_intent.succeeded':
            updates.payment_status = 'succeeded';
            updates.stripe_payment_intent_id = payload.id;
            const receiptUrl = extractReceiptUrl(payload);
            if (payload.amount_received != null) {
                updates.amount_paid = payload.amount_received / 100;
            }
            if (payload.currency) {
                updates.currency = payload.currency;
            }
            mergeDetails.payment_method = payload.payment_method || null;
            mergeDetails.receipt_url = receiptUrl;
            if (receiptUrl) {
                updates.receipt_url = receiptUrl;
            }
            mergeDetails.last_payment_error = payload.last_payment_error || null;
            if (currentOrder.status === 'pending') {
                updates.status = 'processing';
            }
            break;
        case 'invoice.finalized':
            updates.invoice_pdf = payload.invoice_pdf || null;
            if (payload.amount_paid != null) {
                updates.amount_paid = payload.amount_paid / 100;
            }
            if (payload.currency) {
                updates.currency = payload.currency;
            }
            break;
        case 'payment_intent.payment_failed':
            updates.payment_status = 'failed';
            mergeDetails.last_payment_error = payload.last_payment_error || null;
            break;
        case 'payment_intent.canceled':
            updates.payment_status = 'cancelled';
            mergeDetails.cancellation_reason = payload.cancellation_reason || null;
            break;
        case 'charge.refunded':
            updates.payment_status = 'refunded';
            if (payload.amount_refunded != null) {
                updates.amount_refunded = payload.amount_refunded / 100;
            }
            mergeDetails.refund_reason = payload.refunds?.data?.[0]?.reason || null;
            break;
        default:
            break;
    }

    if (Object.keys(mergeDetails).length > 0) {
        updates.payment_details_merge = mergeDetails;
    }

    return updates;
};

const applyOrderUpdates = async (client, orderId, updates) => {
    const fieldFragments = [];
    const values = [];
    let idx = 1;

    Object.entries(updates).forEach(([key, value]) => {
        if (key === 'payment_details_merge') {
            fieldFragments.push(`payment_details = COALESCE(payment_details, '{}'::jsonb) || $${idx}::jsonb`);
            values.push(JSON.stringify(value));
        } else {
            fieldFragments.push(`${key} = $${idx}`);
            values.push(value);
        }
        idx += 1;
    });

    if (fieldFragments.length === 0) {
        return;
    }

    fieldFragments.push(`updated_at = NOW()`);

    await client.query(
        `UPDATE orders SET ${fieldFragments.join(', ')} WHERE id = $${idx}`,
        [...values, orderId]
    );
};

const extractOrderId = (payload) => {
    if (payload?.metadata?.order_id) {
        return parseInt(payload.metadata.order_id, 10);
    }

    if (payload?.charges?.data?.[0]?.metadata?.order_id) {
        const id = parseInt(payload.charges.data[0].metadata.order_id, 10);
        return Number.isNaN(id) ? null : id;
    }

    if (payload?.checkout_session?.metadata?.order_id) {
        const id = parseInt(payload.checkout_session.metadata.order_id, 10);
        return Number.isNaN(id) ? null : id;
    }

    return null;
};

const handleStripeWebhook = async (req, res) => {
    const signature = req.headers['stripe-signature'];

    try {
        const event = constructWebhookEvent(req.body, signature);
        const payload = event.data.object;
        const orderId = extractOrderId(payload);

        await logStripeEvent(event, { orderId, processed: false });

        if (!orderId) {
            return res.json({ received: true });
        }

        await db.transaction(async (client) => {
            const orderResult = await client.query(
                'SELECT id, status, payment_status FROM orders WHERE id = $1 FOR UPDATE',
                [orderId]
            );

            if (orderResult.rows.length === 0) {
                return;
            }

            const currentOrder = orderResult.rows[0];
            const updates = buildOrderUpdates(event.type, payload, currentOrder);

            if (Object.keys(updates).length === 0) {
                return;
            }

            await applyOrderUpdates(client, orderId, updates);
        });

        await logStripeEvent(event, { orderId, processed: true });

        res.json({ received: true });
    } catch (error) {
        console.error('Error procesando webhook de Stripe:', error.message);
        res.status(400).send(`Webhook Error: ${error.message}`);
    }
};

module.exports = {
    handleStripeWebhook,
};

