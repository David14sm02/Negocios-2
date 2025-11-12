const db = require('../config/database');

/**
 * Registra un evento de integración (Dolibarr, Stripe, etc.) en la tabla integration_logs.
 *
 * @param {Object} params
 * @param {string} [params.source='dolibarr'] - Origen del evento (dolibarr, stripe, etc.)
 * @param {string} [params.direction='outbound'] - Dirección de la integración (outbound/inbound)
 * @param {string|null} [params.reference=null] - Identificador relevante (SKU, order_number, etc.)
 * @param {string|null} [params.action=null] - Acción ejecutada (GET /products, POST /orders, etc.)
 * @param {string} [params.status='success'] - Estado del evento (success/error/warning)
 * @param {Object|null} [params.requestPayload=null] - Payload enviado
 * @param {Object|null} [params.responsePayload=null] - Payload recibido
 * @param {string|null} [params.errorMessage=null] - Mensaje de error en caso de fallo
 */
async function logIntegrationEvent({
    source = 'dolibarr',
    direction = 'outbound',
    reference = null,
    action = null,
    status = 'success',
    requestPayload = null,
    responsePayload = null,
    errorMessage = null
} = {}) {
    try {
        await db.query(
            `
            INSERT INTO integration_logs (
                source,
                direction,
                reference,
                action,
                status,
                request_payload,
                response_payload,
                error_message
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
            `,
            [
                source,
                direction,
                reference,
                action,
                status,
                requestPayload ? JSON.stringify(requestPayload) : null,
                responsePayload ? JSON.stringify(responsePayload) : null,
                errorMessage
            ]
        );
    } catch (error) {
        console.error('⚠️ No se pudo registrar el log de integración:', error.message);
    }
}

module.exports = {
    logIntegrationEvent
};

