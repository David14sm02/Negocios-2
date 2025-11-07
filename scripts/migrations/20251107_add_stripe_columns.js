const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'config.env') });

const db = require('../../src/config/database');

async function addStripeColumns() {
    try {
        console.log('🚀 Iniciando migración: columnas Stripe en orders y tabla stripe_events');

        await db.query(`
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255)
        `);

        await db.query(`
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_checkout_session_id VARCHAR(255)
        `);

        await db.query(`
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255)
        `);

        await db.query(`
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'mxn'
        `);

        await db.query(`
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) CHECK (amount_paid >= 0)
        `);

        await db.query(`
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_refunded DECIMAL(10,2) DEFAULT 0 CHECK (amount_refunded >= 0)
        `);

        await db.query(`
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_url VARCHAR(500)
        `);

        await db.query(`
            ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_details JSONB DEFAULT '{}'::jsonb
        `);

        await db.query(`
            CREATE TABLE IF NOT EXISTS stripe_events (
                id SERIAL PRIMARY KEY,
                stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
                type VARCHAR(100) NOT NULL,
                order_id INTEGER REFERENCES orders(id),
                payload JSONB NOT NULL,
                processed BOOLEAN DEFAULT false,
                error TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                processed_at TIMESTAMP
            )
        `);

        await db.query(`CREATE INDEX IF NOT EXISTS idx_orders_payment_intent ON orders(stripe_payment_intent_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_orders_checkout_session ON orders(stripe_checkout_session_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_stripe_events_order ON stripe_events(order_id)`);
        await db.query(`CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(type)`);

        console.log('✅ Migración completada');
    } catch (error) {
        console.error('❌ Error durante la migración:', error.message);
        process.exitCode = 1;
    } finally {
        await db.close();
    }
}

if (require.main === module) {
    addStripeColumns();
}

module.exports = addStripeColumns;


