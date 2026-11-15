// server/routes/industries.js
const express = require('express');
const router = express.Router();
const { query, get, run } = require('../db');
const { logAction } = require('../services/auditService');

// GET all industries with sourcing aggregated stats
router.get('/', (req, res) => {
    try {
        const industries = query(`
            SELECT 
                i.*,
                COALESCE(alloc_stats.total_allocated_qtl, 0) as total_allocated_qtl,
                COALESCE(alloc_stats.total_alloc_amount, 0) as total_alloc_amount,
                COALESCE(load_stats.total_loaded_qtl, 0) as total_loaded_qtl,
                COALESCE(load_stats.total_load_amount, 0) as total_load_amount,
                MAX(0, COALESCE(alloc_stats.total_allocated_qtl, 0) - COALESCE(load_stats.total_loaded_qtl, 0)) as pending_loading_qtl
            FROM industries i
            LEFT JOIN (
                SELECT 
                    industry_id,
                    SUM(allocated_quantity) as total_allocated_qtl,
                    SUM(purchase_amount) as total_alloc_amount
                FROM industry_allocations
                WHERE status != 'Cancelled'
                GROUP BY industry_id
            ) alloc_stats ON i.id = alloc_stats.industry_id
            LEFT JOIN (
                SELECT 
                    industry_id,
                    SUM(loading_quantity) as total_loaded_qtl,
                    SUM(loading_amount) as total_load_amount
                FROM loading_entries
                WHERE loading_status != 'Cancelled'
                GROUP BY industry_id
            ) load_stats ON i.id = load_stats.industry_id
            WHERE i.active = 1
            ORDER BY i.is_default DESC, i.name ASC
        `);
        res.json({ industries });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET single industry profile with loading history & allocation history
router.get('/:id', (req, res) => {
    try {
        const industry = get('SELECT * FROM industries WHERE id = ?', [req.params.id]);
        if (!industry) {
            return res.status(404).json({ error: 'Industry not found' });
        }

        const allocations = query(`
            SELECT 
                ia.*,
                po.po_number,
                po.po_date,
                c.name as customer_name,
                p.name as product_name
            FROM industry_allocations ia
            JOIN purchase_orders po ON ia.po_id = po.id
            JOIN customers c ON po.customer_id = c.id
            JOIN products p ON ia.product_id = p.id
            WHERE ia.industry_id = ?
            ORDER BY ia.created_at DESC
        `, [industry.id]);

        const loadingEntries = query(`
            SELECT 
                le.*,
                po.po_number,
                c.name as customer_name,
                p.name as product_name
            FROM loading_entries le
            JOIN purchase_orders po ON le.po_id = po.id
            JOIN customers c ON po.customer_id = c.id
            JOIN products p ON le.product_id = p.id
            WHERE le.industry_id = ?
            ORDER BY le.loading_date DESC
        `, [industry.id]);

        res.json({
            industry,
            allocations,
            loadingEntries
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Industry / Mill / Godown
router.post('/', (req, res) => {
    try {
        const {
            name,
            location,
            contact_person,
            phone,
            available_products,
            default_purchase_rate,
            notes,
            is_default,
            capacity_qtl,
            facility_type
        } = req.body;
        if (!name || !location) {
            return res.status(400).json({ error: 'Name and location are required' });
        }

        const isDef = is_default ? 1 : 0;
        if (isDef === 1) {
            run('UPDATE industries SET is_default = 0');
        }

        const stmt = run(`
            INSERT INTO industries (
                name, location, contact_person, phone, available_products,
                default_purchase_rate, notes, is_default, capacity_qtl, facility_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            name,
            location,
            contact_person || '',
            phone || '',
            available_products || '',
            Number(default_purchase_rate) || 0,
            notes || '',
            isDef,
            Number(capacity_qtl) || 15000,
            facility_type || 'Rice Mill & Godown'
        ]);

        logAction('Industry', stmt.lastInsertRowid, 'CREATE', req.user?.username || 'Staff', { name, location });
        res.status(201).json({ id: stmt.lastInsertRowid, message: 'Industry created successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Industry / Mill / Godown
router.put('/:id', (req, res) => {
    try {
        const {
            name,
            location,
            contact_person,
            phone,
            available_products,
            default_purchase_rate,
            notes,
            active,
            is_default,
            capacity_qtl,
            facility_type
        } = req.body;

        const isDef = is_default ? 1 : 0;
        if (isDef === 1) {
            run('UPDATE industries SET is_default = 0 WHERE id != ?', [req.params.id]);
        }

        run(`
            UPDATE industries
            SET name = ?,
                location = ?,
                contact_person = ?,
                phone = ?,
                available_products = ?,
                default_purchase_rate = ?,
                notes = ?,
                is_default = COALESCE(?, is_default),
                capacity_qtl = COALESCE(?, capacity_qtl),
                facility_type = COALESCE(?, facility_type),
                active = COALESCE(?, active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            name,
            location,
            contact_person,
            phone,
            available_products,
            Number(default_purchase_rate) || 0,
            notes,
            is_default !== undefined ? isDef : null,
            capacity_qtl !== undefined ? Number(capacity_qtl) : null,
            facility_type || null,
            active,
            req.params.id
        ]);

        logAction('Industry', req.params.id, 'UPDATE', req.user?.username || 'Staff', req.body);
        res.json({ message: 'Industry updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Set Preferred Default Industry
router.post('/:id/set-default', (req, res) => {
    try {
        const { id } = req.params;
        const ind = get('SELECT id, name FROM industries WHERE id = ?', [id]);
        if (!ind) return res.status(404).json({ error: 'Industry not found' });

        run('UPDATE industries SET is_default = 0');
        run('UPDATE industries SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);

        logAction('Industry', id, 'SET_DEFAULT', req.user?.username || 'Staff', { name: ind.name });
        res.json({ success: true, message: `${ind.name} set as preferred default industry.` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

