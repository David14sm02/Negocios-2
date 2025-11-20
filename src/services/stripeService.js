const Stripe = require('stripe');

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

// No lanzar error al importarse, solo mostrar advertencia
if (!STRIPE_SECRET_KEY) {
    console.warn('⚠️ STRIPE_SECRET_KEY no está configurado en config.env. Las funcionalidades de pago no estarán disponibles hasta que se configure.');
}

// Validar si la clave parece ser un placeholder
if (STRIPE_SECRET_KEY && (STRIPE_SECRET_KEY.includes('tu_stripe_secret_key') || (STRIPE_SECRET_KEY.includes('sk_test_') && STRIPE_SECRET_KEY.length < 50))) {
    console.warn('⚠️ ADVERTENCIA: STRIPE_SECRET_KEY parece ser un placeholder. Por favor, configura una clave real de Stripe en config.env');
}

// Crear instancia de Stripe solo si hay clave configurada
let stripe = null;
if (STRIPE_SECRET_KEY) {
    try {
        stripe = new Stripe(STRIPE_SECRET_KEY, {
            apiVersion: '2023-10-16',
        });
    } catch (error) {
        console.warn('⚠️ Error inicializando Stripe:', error.message);
    }
}

/**
 * Validar que Stripe esté configurado antes de usar
 * @throws {Error} Si Stripe no está configurado
 */
const _validateStripe = () => {
    if (!STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY no está configurado en config.env');
    }
    if (!stripe) {
        throw new Error('Stripe no está inicializado. Verifica tu configuración.');
    }
};

const getSuccessUrl = () => {
    return process.env.STRIPE_SUCCESS_URL || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/success`;
};

const getCancelUrl = () => {
    return process.env.STRIPE_CANCEL_URL || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkout/cancel`;
};

const constructWebhookEvent = (payload, signature) => {
    _validateStripe();
    
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

/**
 * Crear un proxy para stripe que valide antes de cada uso
 */
const createStripeProxy = () => {
    return new Proxy({}, {
        get(target, prop) {
            _validateStripe();
            // Si stripe está configurado, devolver la propiedad/método real
            if (stripe) {
                const value = stripe[prop];
                if (typeof value === 'function') {
                    return (...args) => {
                        _validateStripe();
                        return value.apply(stripe, args);
                    };
                }
                return value;
            }
            // Si no está configurado, esto no debería ejecutarse porque _validateStripe lanza error
            return undefined;
        }
    });
};

// Exportar proxy que valida automáticamente
const stripeProxy = createStripeProxy();

module.exports = {
    stripe: stripeProxy,
    getSuccessUrl,
    getCancelUrl,
    constructWebhookEvent,
    extractReceiptUrl,
};


