const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

const db = require('../src/config/database');

async function run() {
    try {
        const orders = await db.query(
            `SELECT id, order_number, total, created_at
             FROM orders
             ORDER BY created_at DESC
             LIMIT 5`
        );
        console.log('=== ORDERS ===');
        console.table(orders.rows);

        const items = await db.query(
            `SELECT order_id, product_id, quantity, price, total, created_at
             FROM order_items
             ORDER BY created_at DESC
             LIMIT 5`
        );
        console.log('\n=== ORDER ITEMS ===');
        console.table(items.rows);

        const products = await db.query(
            `SELECT id, sku, stock
             FROM products
             WHERE sku IN ('RJ45-CAT6', 'CAT6-305M', 'CAT6A-305M')`
        );
        console.log('\n=== PRODUCT STOCK ===');
        console.table(products.rows);

        const logs = await db.query(
            `SELECT id, action, status, reference, error_message, created_at
             FROM integration_logs
             ORDER BY created_at DESC
             LIMIT 10`
        );
        console.log('\n=== INTEGRATION LOGS ===');
        console.table(
            logs.rows.map((row) => ({
                ...row,
                error_message: row.error_message ? row.error_message.substring(0, 80) : null
            }))
        );
    } catch (error) {
        console.error('Error checking status:', error);
    } finally {
        await db.close();
    }
}

run();

