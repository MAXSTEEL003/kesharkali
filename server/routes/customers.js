// server/routes/customers.js
const express = require('express');
const router = express.Router();
const { query, get, run } = require('../db');
const { logAction } = require('../services/auditService');

// GET all customers with aggregated operational statistics
router.get('/', (req, res) => {
    try {
        const customers = query(`
            SELECT 
                c.*,
                COALESCE(po_stats.total_orders, 0) as total_orders,
                COALESCE(po_stats.total_ordered_qtl, 0) as total_ordered_qtl,
                COALESCE(dsp_stats.total_dispatched_qtl, 0) as total_dispatched_qtl,
                MAX(0, COALESCE(po_stats.total_ordered_qtl, 0) - COALESCE(dsp_stats.total_dispatched_qtl, 0)) as pending_qtl
            FROM customers c
            LEFT JOIN (
                SELECT 
                    customer_id,
                    COUNT(id) as total_orders,
                    SUM(ordered_quantity) as total_ordered_qtl
                FROM purchase_orders
                WHERE status != 'Cancelled'
                GROUP BY customer_id
            ) po_stats ON c.id = po_stats.customer_id
            LEFT JOIN (
                SELECT 
                    po.customer_id,
                    SUM(d.dispatch_quantity) as total_dispatched_qtl
                FROM dispatches d
                JOIN purchase_orders po ON d.po_id = po.id
                GROUP BY po.customer_id
            ) dsp_stats ON c.id = dsp_stats.customer_id
            WHERE c.active = 1
            ORDER BY c.name ASC
        `);
        res.json({ customers });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET single customer profile with PO history & dispatch history (STRICT PRIVACY - no industry or purchase rates)
router.get('/:id', (req, res) => {
    try {
        const customer = get('SELECT * FROM customers WHERE id = ?', [req.params.id]);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Customer's PO history
        const purchaseOrders = query(`
            SELECT 
                po.id,
                po.po_number,
                po.po_date,
                po.ordered_quantity,
                po.customer_selling_rate,
                po.delivery_location,
                po.status,
                p.name as product_name,
                p.variety as product_variety,
                COALESCE(SUM(d.dispatch_quantity), 0) as dispatched_quantity,
                MAX(0, po.ordered_quantity - COALESCE(SUM(d.dispatch_quantity), 0)) as remaining_quantity
            FROM purchase_orders po
            JOIN products p ON po.product_id = p.id
            LEFT JOIN dispatches d ON po.id = d.po_id
            WHERE po.customer_id = ?
            GROUP BY po.id
            ORDER BY po.po_date DESC
        `, [customer.id]);

        // Customer's dispatch history (Strictly no industry names)
        const dispatches = query(`
            SELECT 
                d.id,
                d.dispatch_number,
                d.dispatch_date,
                d.dispatch_quantity,
                d.vehicle_number,
                d.notification_status,
                po.po_number,
                p.name as product_name
            FROM dispatches d
            JOIN purchase_orders po ON d.po_id = po.id
            JOIN products p ON po.product_id = p.id
            WHERE po.customer_id = ?
            ORDER BY d.dispatch_date DESC
        `, [customer.id]);

        res.json({
            customer,
            purchaseOrders,
            dispatches
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Customer
router.post('/', (req, res) => {
    try {
        const { name, contact_person, phone, whatsapp_number, address, city, gstin, notes } = req.body;
        if (!name || !whatsapp_number) {
            return res.status(400).json({ error: 'Customer name and WhatsApp number are required' });
        }

        const stmt = run(`
            INSERT INTO customers (name, contact_person, phone, whatsapp_number, address, city, gstin, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [name, contact_person || '', phone || '', whatsapp_number, address || '', city || '', gstin || '', notes || '']);

        logAction('Customer', stmt.lastInsertRowid, 'CREATE', req.user?.username || 'Staff', { name, whatsapp_number });
        res.status(201).json({ id: stmt.lastInsertRowid, message: 'Customer created successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Customer
router.put('/:id', (req, res) => {
    try {
        const { name, contact_person, phone, whatsapp_number, address, city, gstin, notes, active } = req.body;
        run(`
            UPDATE customers
            SET name = ?, contact_person = ?, phone = ?, whatsapp_number = ?, address = ?, city = ?, gstin = ?, notes = ?, active = COALESCE(?, active), updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [name, contact_person, phone, whatsapp_number, address, city, gstin, notes, active, req.params.id]);

        logAction('Customer', req.params.id, 'UPDATE', req.user?.username || 'Staff', req.body);
        res.json({ message: 'Customer updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Customer (safe check)
router.delete('/:id', (req, res) => {
    try {
        const pos = get('SELECT COUNT(*) as count FROM purchase_orders WHERE customer_id = ?', [req.params.id]);
        if (pos.count > 0) {
            return res.status(400).json({ error: `Cannot delete customer with ${pos.count} existing purchase order(s). Deactivate instead.` });
        }

        run('DELETE FROM customers WHERE id = ?', [req.params.id]);
        logAction('Customer', req.params.id, 'DELETE', req.user?.username || 'Staff');
        res.json({ message: 'Customer deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

