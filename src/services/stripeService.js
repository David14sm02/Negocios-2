const Stripe = require('stripe');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY no está configurado en el entorno.');
}

if (STRIPE_SECRET_KEY.includes('tu_stripe_secret_key') || STRIPE_SECRET_KEY.includes('sk_test_') && STRIPE_SECRET_KEY.length < 50) {
    console.error('⚠️ ADVERTENCIA: STRIPE_SECRET_KEY parece ser un placeholder. Por favor, configura una clave real de Stripe en config.env');
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
});

const getSuccessUrl = () => {
    return process.env.STRIPE_SUCCESS_URL || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/success`;
};

const getCancelUrl = () => {
    return process.env.STRIPE_CANCEL_URL || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/cancel`;
};

const constructWebhookEvent = (payload, signature) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET no está configurado en el entorno.');
    }

    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
};

const extractReceiptUrl = (paymentIntent) => {
    if (!paymentIntent || !paymentIntent.charges || !paymentIntent.charges.data) {
        return null;
    }

    const charge = paymentIntent.charges.data.find((item) => item.receipt_url);
    return charge ? charge.receipt_url : null;
};

module.exports = {
    stripe,
    getSuccessUrl,
    getCancelUrl,
    constructWebhookEvent,
    extractReceiptUrl,
};


