// server/routes/reports.js
const express = require('express');
const router = express.Router();
const { query } = require('../db');
const {
    generateMasterLoadingExcel,
    generateIndustryWiseExcel,
    generateBuyerWiseExcel,
    generatePOFulfillmentExcel,
    generateStockLedgerExcel
} = require('../services/excelService');
const { getStockSummary } = require('../services/stockService');

// Helper to set excel download headers
function setExcelHeaders(res, filename) {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
}

// 1. Master Loading Register Report (JSON + Export)
router.get('/master-loading', (req, res) => {
    try {
        const { startDate, endDate, buyerId, industryId, fulfillmentType } = req.query;
        let sql = `
            SELECT 
                le.*,
                po.po_number,
                c.name as customer_name,
                i.name as industry_name,
                p.name as product_name
            FROM loading_entries le
            JOIN purchase_orders po ON le.po_id = po.id
            JOIN customers c ON po.customer_id = c.id
            JOIN industries i ON le.industry_id = i.id
            JOIN products p ON le.product_id = p.id
            WHERE le.loading_status != 'Cancelled'
        `;
        const params = [];
        if (startDate) { sql += ' AND le.loading_date >= ?'; params.push(startDate); }
        if (endDate) { sql += ' AND le.loading_date <= ?'; params.push(endDate); }
        if (buyerId) { sql += ' AND po.customer_id = ?'; params.push(buyerId); }
        if (industryId) { sql += ' AND le.industry_id = ?'; params.push(industryId); }
        if (fulfillmentType) { sql += ' AND le.fulfillment_type = ?'; params.push(fulfillmentType); }
        sql += ' ORDER BY le.loading_date DESC, le.id DESC';

        const rows = query(sql, params);
        res.json({ report: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/export/master-loading', async (req, res) => {
    try {
        const { startDate, endDate, buyerId, industryId, fulfillmentType } = req.query;
        let sql = `
            SELECT 
                le.*,
                po.po_number,
                c.name as customer_name,
                i.name as industry_name,
                p.name as product_name
            FROM loading_entries le
            JOIN purchase_orders po ON le.po_id = po.id
            JOIN customers c ON po.customer_id = c.id
            JOIN industries i ON le.industry_id = i.id
            JOIN products p ON le.product_id = p.id
            WHERE le.loading_status != 'Cancelled'
        `;
        const params = [];
        if (startDate) { sql += ' AND le.loading_date >= ?'; params.push(startDate); }
        if (endDate) { sql += ' AND le.loading_date <= ?'; params.push(endDate); }
        if (buyerId) { sql += ' AND po.customer_id = ?'; params.push(buyerId); }
        if (industryId) { sql += ' AND le.industry_id = ?'; params.push(industryId); }
        if (fulfillmentType) { sql += ' AND le.fulfillment_type = ?'; params.push(fulfillmentType); }
        sql += ' ORDER BY le.loading_date DESC, le.id DESC';

        const rows = query(sql, params);
        const buffer = await generateMasterLoadingExcel(rows);

        const filename = `Keshar_Kali_Master_Loading_${new Date().toISOString().split('T')[0]}.xlsx`;
        setExcelHeaders(res, filename);
        res.send(Buffer.from(buffer));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Industry-wise Report (JSON + Export)
router.get('/industry-wise', (req, res) => {
    try {
        const { industryId, startDate, endDate } = req.query;
        let sql = `
            SELECT 
                le.*,
                i.name as industry_name,
                po.po_number,
                c.name as customer_name,
                p.name as product_name
            FROM loading_entries le
            JOIN industries i ON le.industry_id = i.id
            JOIN purchase_orders po ON le.po_id = po.id
            JOIN customers c ON po.customer_id = c.id
            JOIN products p ON le.product_id = p.id
            WHERE le.loading_status != 'Cancelled'
        `;
        const params = [];
        if (industryId) { sql += ' AND le.industry_id = ?'; params.push(industryId); }
        if (startDate) { sql += ' AND le.loading_date >= ?'; params.push(startDate); }
        if (endDate) { sql += ' AND le.loading_date <= ?'; params.push(endDate); }
        sql += ' ORDER BY i.name ASC, le.loading_date DESC';

        const rows = query(sql, params);
        res.json({ report: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/export/industry-wise', async (req, res) => {
    try {
        const { industryId, startDate, endDate } = req.query;
        let sql = `
            SELECT 
                le.*,
                i.name as industry_name,
                po.po_number,
                c.name as customer_name,
                p.name as product_name
            FROM loading_entries le
            JOIN industries i ON le.industry_id = i.id
            JOIN purchase_orders po ON le.po_id = po.id
            JOIN customers c ON po.customer_id = c.id
            JOIN products p ON le.product_id = p.id
            WHERE le.loading_status != 'Cancelled'
        `;
        const params = [];
        if (industryId) { sql += ' AND le.industry_id = ?'; params.push(industryId); }
        if (startDate) { sql += ' AND le.loading_date >= ?'; params.push(startDate); }
        if (endDate) { sql += ' AND le.loading_date <= ?'; params.push(endDate); }
        sql += ' ORDER BY i.name ASC, le.loading_date DESC';

        const rows = query(sql, params);
        const buffer = await generateIndustryWiseExcel(rows);

        const filename = `Keshar_Kali_Industry_Wise_${new Date().toISOString().split('T')[0]}.xlsx`;
        setExcelHeaders(res, filename);
        res.send(Buffer.from(buffer));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Buyer-wise Report (JSON + Export)
router.get('/buyer-wise', (req, res) => {
    try {
        const { buyerId, startDate, endDate } = req.query;
        let sql = `
            SELECT 
                po.id,
                po.po_number,
                po.po_date,
                po.ordered_quantity,
                po.customer_selling_rate,
                po.status,
                (po.ordered_quantity * po.customer_selling_rate) as order_value,
                c.name as customer_name,
                p.name as product_name,
                COALESCE(load_stats.total_loaded, 0) as loaded_quantity,
                COALESCE(dsp_stats.total_dispatched, 0) as dispatched_quantity,
                MAX(0, po.ordered_quantity - COALESCE(dsp_stats.total_dispatched, 0)) as remaining_quantity
            FROM purchase_orders po
            JOIN customers c ON po.customer_id = c.id
            JOIN products p ON po.product_id = p.id
            LEFT JOIN (
                SELECT po_id, SUM(loading_quantity) as total_loaded
                FROM loading_entries
                WHERE loading_status != 'Cancelled'
                GROUP BY po_id
            ) load_stats ON po.id = load_stats.po_id
            LEFT JOIN (
                SELECT po_id, SUM(dispatch_quantity) as total_dispatched
                FROM dispatches
                GROUP BY po_id
            ) dsp_stats ON po.id = dsp_stats.po_id
            WHERE po.status != 'Cancelled'
        `;
        const params = [];
        if (buyerId) { sql += ' AND po.customer_id = ?'; params.push(buyerId); }
        if (startDate) { sql += ' AND po.po_date >= ?'; params.push(startDate); }
        if (endDate) { sql += ' AND po.po_date <= ?'; params.push(endDate); }
        sql += ' ORDER BY c.name ASC, po.po_date DESC';

        const rows = query(sql, params);
        res.json({ report: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/export/buyer-wise', async (req, res) => {
    try {
        const { buyerId, startDate, endDate } = req.query;
        let sql = `
            SELECT 
                po.id,
                po.po_number,
                po.po_date,
                po.ordered_quantity,
                po.customer_selling_rate,
                po.status,
                (po.ordered_quantity * po.customer_selling_rate) as order_value,
                c.name as customer_name,
                p.name as product_name,
                COALESCE(load_stats.total_loaded, 0) as loaded_quantity,
                COALESCE(dsp_stats.total_dispatched, 0) as dispatched_quantity,
                MAX(0, po.ordered_quantity - COALESCE(dsp_stats.total_dispatched, 0)) as remaining_quantity
            FROM purchase_orders po
            JOIN customers c ON po.customer_id = c.id
            JOIN products p ON po.product_id = p.id
            LEFT JOIN (
                SELECT po_id, SUM(loading_quantity) as total_loaded
                FROM loading_entries
                WHERE loading_status != 'Cancelled'
                GROUP BY po_id
            ) load_stats ON po.id = load_stats.po_id
            LEFT JOIN (
                SELECT po_id, SUM(dispatch_quantity) as total_dispatched
                FROM dispatches
                GROUP BY po_id
            ) dsp_stats ON po.id = dsp_stats.po_id
            WHERE po.status != 'Cancelled'
        `;
        const params = [];
        if (buyerId) { sql += ' AND po.customer_id = ?'; params.push(buyerId); }
        if (startDate) { sql += ' AND po.po_date >= ?'; params.push(startDate); }
        if (endDate) { sql += ' AND po.po_date <= ?'; params.push(endDate); }
        sql += ' ORDER BY c.name ASC, po.po_date DESC';

        const rows = query(sql, params);
        const buffer = await generateBuyerWiseExcel(rows);

        const filename = `Keshar_Kali_Buyer_Wise_${new Date().toISOString().split('T')[0]}.xlsx`;
        setExcelHeaders(res, filename);
        res.send(Buffer.from(buffer));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. PO-wise Fulfillment Report (JSON + Export)
router.get('/po-fulfillment', (req, res) => {
    try {
        const rows = query(`
            SELECT 
                po.po_number,
                po.ordered_quantity,
                po.customer_selling_rate,
                c.name as customer_name,
                p.name as product_name,
                COALESCE(alloc_stats.total_allocated, 0) as allocated_quantity,
                COALESCE(load_stats.total_loaded, 0) as loaded_quantity,
                COALESCE(dsp_stats.total_dispatched, 0) as dispatched_quantity,
                MAX(0, po.ordered_quantity - COALESCE(load_stats.total_loaded, 0)) as pending_loading,
                MAX(0, COALESCE(load_stats.total_loaded, 0) - COALESCE(dsp_stats.total_dispatched, 0)) as pending_dispatch
            FROM purchase_orders po
            JOIN customers c ON po.customer_id = c.id
            JOIN products p ON po.product_id = p.id
            LEFT JOIN (
                SELECT po_id, SUM(allocated_quantity) as total_allocated
                FROM industry_allocations
                WHERE status != 'Cancelled'
                GROUP BY po_id
            ) alloc_stats ON po.id = alloc_stats.po_id
            LEFT JOIN (
                SELECT po_id, SUM(loading_quantity) as total_loaded
                FROM loading_entries
                WHERE loading_status != 'Cancelled'
                GROUP BY po_id
            ) load_stats ON po.id = load_stats.po_id
            LEFT JOIN (
                SELECT po_id, SUM(dispatch_quantity) as total_dispatched
                FROM dispatches
                GROUP BY po_id
            ) dsp_stats ON po.id = dsp_stats.po_id
            WHERE po.status != 'Cancelled'
            ORDER BY po.po_date DESC
        `);
        res.json({ report: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/export/po-fulfillment', async (req, res) => {
    try {
        const rows = query(`
            SELECT 
                po.po_number,
                po.ordered_quantity,
                c.name as customer_name,
                p.name as product_name,
                COALESCE(alloc_stats.total_allocated, 0) as allocated_quantity,
                COALESCE(load_stats.total_loaded, 0) as loaded_quantity,
                COALESCE(dsp_stats.total_dispatched, 0) as dispatched_quantity,
                MAX(0, po.ordered_quantity - COALESCE(load_stats.total_loaded, 0)) as pending_loading,
                MAX(0, COALESCE(load_stats.total_loaded, 0) - COALESCE(dsp_stats.total_dispatched, 0)) as pending_dispatch
            FROM purchase_orders po
            JOIN customers c ON po.customer_id = c.id
            JOIN products p ON po.product_id = p.id
            LEFT JOIN (
                SELECT po_id, SUM(allocated_quantity) as total_allocated
                FROM industry_allocations
                WHERE status != 'Cancelled'
                GROUP BY po_id
            ) alloc_stats ON po.id = alloc_stats.po_id
            LEFT JOIN (
                SELECT po_id, SUM(loading_quantity) as total_loaded
                FROM loading_entries
                WHERE loading_status != 'Cancelled'
                GROUP BY po_id
            ) load_stats ON po.id = load_stats.po_id
            LEFT JOIN (
                SELECT po_id, SUM(dispatch_quantity) as total_dispatched
                FROM dispatches
                GROUP BY po_id
            ) dsp_stats ON po.id = dsp_stats.po_id
            WHERE po.status != 'Cancelled'
            ORDER BY po.po_date DESC
        `);

        const buffer = await generatePOFulfillmentExcel(rows);
        const filename = `Keshar_Kali_PO_Fulfillment_${new Date().toISOString().split('T')[0]}.xlsx`;
        setExcelHeaders(res, filename);
        res.send(Buffer.from(buffer));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Stock Ledger & Summary Excel Export
router.get('/export/stock-ledger', async (req, res) => {
    try {
        const { productId } = req.query;
        let sql = `
            SELECT 
                sl.*,
                p.name as product_name
            FROM stock_ledger sl
            JOIN products p ON sl.product_id = p.id
            WHERE 1=1
        `;
        const params = [];
        if (productId) {
            sql += ' AND sl.product_id = ?';
            params.push(productId);
        }
        sql += ' ORDER BY sl.date DESC, sl.id DESC';

        const ledgerRows = query(sql, params);
        const summaryRows = getStockSummary();

        const buffer = await generateStockLedgerExcel(ledgerRows, summaryRows);
        const filename = `Keshar_Kali_Stock_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`;
        setExcelHeaders(res, filename);
        res.send(Buffer.from(buffer));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
