// server/routes/products.js
const express = require('express');
const router = express.Router();
const { query, get, run } = require('../db');
const { getPhysicalStock, getReservedStock, getAvailableStock } = require('../services/stockService');
const { logAction } = require('../services/auditService');

// GET all products with current stock status
router.get('/', (req, res) => {
    try {
        const products = query('SELECT * FROM products WHERE active = 1 ORDER BY name ASC');
        const enriched = products.map(p => {
            const physical = getPhysicalStock(p.id);
            return {
                ...p,
                physical_stock: physical,
                reserved_stock: 0,
                available_stock: physical,
                is_low_stock: physical <= p.min_stock_threshold
            };
        });
        res.json({ products: enriched });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET single product
router.get('/:id', (req, res) => {
    try {
        const product = get('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (!product) return res.status(404).json({ error: 'Product not found' });

        const physical = getPhysicalStock(product.id);

        res.json({
            product: {
                ...product,
                physical_stock: physical,
                reserved_stock: 0,
                available_stock: physical
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create product
router.post('/', (req, res) => {
    try {
        const { code, name, brand, variety, unit = 'QTL', min_stock_threshold = 50, standard_selling_rate = 0 } = req.body;
        if (!code || !name) {
            return res.status(400).json({ error: 'Code and name are required' });
        }

        const stmt = run(`
            INSERT INTO products (code, name, brand, variety, unit, min_stock_threshold, standard_selling_rate)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [code.toUpperCase(), name, brand || 'Keshar Kali', variety || name, unit, min_stock_threshold, standard_selling_rate]);

        logAction('Product', stmt.lastInsertRowid, 'CREATE', req.user?.username || 'Staff', { code, name });
        res.status(201).json({ id: stmt.lastInsertRowid, message: 'Product created' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update product
router.put('/:id', (req, res) => {
    try {
        const existing = get('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (!existing) return res.status(404).json({ error: 'Product not found' });

        const { code, name, brand, variety, unit, min_stock_threshold, standard_selling_rate, active } = req.body;
        run(`
            UPDATE products
            SET code = COALESCE(?, code),
                name = COALESCE(?, name),
                brand = COALESCE(?, brand),
                variety = COALESCE(?, variety),
                unit = COALESCE(?, unit),
                min_stock_threshold = COALESCE(?, min_stock_threshold),
                standard_selling_rate = COALESCE(?, standard_selling_rate),
                active = COALESCE(?, active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            code ? code.toUpperCase() : null,
            name ?? null,
            brand ?? null,
            variety ?? null,
            unit ?? null,
            min_stock_threshold !== undefined && min_stock_threshold !== null ? Number(min_stock_threshold) : null,
            standard_selling_rate !== undefined && standard_selling_rate !== null ? Number(standard_selling_rate) : null,
            active !== undefined && active !== null ? Number(active) : null,
            req.params.id
        ]);

        logAction('Product', req.params.id, 'UPDATE', req.user?.username || 'Staff', req.body);
        res.json({ success: true, message: 'Product updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

