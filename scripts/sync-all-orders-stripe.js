/**
 * Script para sincronizar todos los pedidos existentes con Stripe
 * Actualiza el estado de pago y las facturas de todos los pedidos que tienen IDs de Stripe
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

const db = require('../src/config/database');
const { stripe, extractReceiptUrl } = require('../src/services/stripeService');

async function syncAllOrdersWithStripe() {
    try {
        console.log('🚀 Iniciando sincronización de todos los pedidos con Stripe...\n');

        if (!stripe) {
            console.error('❌ Stripe no está configurado. Verifica STRIPE_SECRET_KEY en config.env');
            process.exit(1);
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
            console.log('ℹ️  No se encontraron pedidos con información de Stripe.\n');
            await db.close();
            process.exit(0);
        }

        console.log(`📦 Se encontraron ${orders.length} pedidos con información de Stripe.\n`);
        console.log('⏳ Procesando pedidos...\n');

        const results = {
            total: orders.length,
            updated: 0,
            succeeded: 0,
            invoiceFound: 0,
            errors: 0,
            skipped: 0
        };

        // Procesar cada pedido
        for (let i = 0; i < orders.length; i++) {
            const order = orders[i];
            const progress = `[${i + 1}/${orders.length}]`;
            
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
                                    // Ignorar si ya está finalizada o hay otro error
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
                        console.warn(`${progress} ⚠️  Error obteniendo checkout session para ${order.order_number}:`, error.message);
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
                        console.warn(`${progress} ⚠️  Error obteniendo payment intent para ${order.order_number}:`, error.message);
                    }
                }

                // Si se encontró un estado de pago exitoso, actualizar la orden
                if (paymentStatus === 'succeeded') {
                    const updateFields = [];
                    const updateValues = [];
                    let paramCount = 1;

                    // Solo actualizar si hay cambios necesarios
                    const needsUpdate = 
                        order.payment_status !== 'succeeded' ||
                        (shouldUpdateStatus && order.status === 'pending') ||
                        (invoicePdf && order.invoice_pdf !== invoicePdf) ||
                        (receiptUrl && order.receipt_url !== receiptUrl);

                    if (!needsUpdate && order.payment_status === 'succeeded') {
                        console.log(`${progress} ⏭️  ${order.order_number}: Ya está actualizado (succeeded)`);
                        results.skipped++;
                        continue;
                    }

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

                    console.log(`${progress} ✅ ${order.order_number}: Actualizado (succeeded)`);
                    if (invoicePdf) {
                        console.log(`      📄 Factura encontrada: ${invoicePdf}`);
                        results.invoiceFound++;
                    }
                    if (receiptUrl) {
                        console.log(`      🧾 Recibo encontrado: ${receiptUrl}`);
                    }

                    results.updated++;
                    results.succeeded++;
                } else {
                    console.log(`${progress} ⏭️  ${order.order_number}: No tiene pago exitoso (status: ${order.payment_status})`);
                    results.skipped++;
                }
            } catch (error) {
                console.error(`${progress} ❌ Error procesando ${order.order_number}:`, error.message);
                results.errors++;
            }
        }

        // Mostrar resumen
        console.log('\n' + '='.repeat(50));
        console.log('📊 RESUMEN DE SINCRONIZACIÓN');
        console.log('='.repeat(50));
        console.log(`Total de pedidos: ${results.total}`);
        console.log(`✅ Actualizados: ${results.updated}`);
        console.log(`   └─ Con pago exitoso: ${results.succeeded}`);
        console.log(`   └─ Con factura encontrada: ${results.invoiceFound}`);
        console.log(`⏭️  Omitidos: ${results.skipped}`);
        console.log(`❌ Errores: ${results.errors}`);
        console.log('='.repeat(50) + '\n');

        console.log('✅ Sincronización completada.\n');
    } catch (error) {
        console.error('❌ Error en sincronización:', error);
        process.exit(1);
    } finally {
        await db.close();
        process.exit(0);
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    syncAllOrdersWithStripe();
}

module.exports = { syncAllOrdersWithStripe };

