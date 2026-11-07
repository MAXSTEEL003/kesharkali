// server/routes/warehouses.js
const express = require('express');
const router = express.Router();
const { query, get, run } = require('../db');
const { logAction } = require('../services/auditService');

// GET all warehouses with occupied stock
router.get('/', (req, res) => {
    try {
        const warehouses = query('SELECT * FROM warehouses WHERE active = 1 ORDER BY id ASC');
        const enriched = warehouses.map(w => {
            const row = get(`
                SELECT COALESCE(SUM(inward_quantity - outward_quantity), 0) as current_stock
                FROM stock_ledger
                WHERE warehouse_id = ?
            `, [w.id]);
            const currentStock = Math.max(0, Number(row?.current_stock || 0));
            return {
                ...w,
                current_stock: currentStock,
                occupancy_pct: w.capacity_qtl > 0 ? Number(((currentStock / w.capacity_qtl) * 100).toFixed(1)) : 0
            };
        });
        res.json({ warehouses: enriched });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create warehouse
router.post('/', (req, res) => {
    try {
        const { name, location, capacity_qtl, manager_name, contact_phone } = req.body;
        if (!name || !location) return res.status(400).json({ error: 'Name and location are required' });

        const stmt = run(`
            INSERT INTO warehouses (name, location, capacity_qtl, manager_name, contact_phone)
            VALUES (?, ?, ?, ?, ?)
        `, [name, location, capacity_qtl || 10000, manager_name || '', contact_phone || '']);

        logAction('Warehouse', stmt.lastInsertRowid, 'CREATE', req.user?.username || 'Staff', { name, location });
        res.status(201).json({ id: stmt.lastInsertRowid, message: 'Warehouse created' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

