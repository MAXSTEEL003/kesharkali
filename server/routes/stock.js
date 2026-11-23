// server/routes/stock.js
const express = require('express');
const router = express.Router();
const { query, get, run } = require('../db');
const {
    getPhysicalStock,
    getReservedStock,
    getAvailableStock,
    recordInward,
    recordOutward,
    reserveStock,
    releaseReservation,
    transferStock,
    adjustStock,
    getStockValuation,
    getStockSummary
} = require('../services/stockService');
const { logAction } = require('../services/auditService');

// Stock Dashboard statistics
router.get('/dashboard', (req, res) => {
    try {
        const valuation = getStockValuation();
        const summary = getStockSummary();

        const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

        const monthInwardRow = get(`
            SELECT COALESCE(SUM(inward_quantity), 0) as total
            FROM stock_ledger
            WHERE strftime('%Y-%m', date) = ?
        `, [currentMonth]);

        const monthOutwardRow = get(`
            SELECT COALESCE(SUM(outward_quantity), 0) as total
            FROM stock_ledger
            WHERE strftime('%Y-%m', date) = ?
        `, [currentMonth]);

        const lowStockCount = summary.filter(s => s.isLowStock).length;

        // Mill level breakdown (using industries table since there are no separate godowns)
        const industries = query('SELECT * FROM industries WHERE active = 1');
        const facilities = industries.length > 0 ? industries : query('SELECT * FROM warehouses WHERE active = 1');
        const warehouseBreakdown = facilities.map(f => {
            const row = get(`
                SELECT COALESCE(SUM(inward_quantity - outward_quantity), 0) as stock
                FROM stock_ledger
                WHERE warehouse_id = ?
            `, [f.id]);
            const occupied = Math.max(0, Number(row?.stock || 0));
            const cap = Number(f.capacity_qtl || 15000);
            return {
                warehouseId: f.id,
                millId: f.id,
                warehouseName: f.name,
                millName: f.name,
                location: f.location,
                capacityQtl: cap,
                occupiedQtl: occupied,
                utilizationPct: cap > 0 ? Number(((occupied / cap) * 100).toFixed(1)) : 0
            };
        });

        res.json({
            totalPhysicalStock: valuation.grandTotalStock,
            totalReservedStock: 0,
            totalAvailableStock: valuation.grandTotalStock,
            stockReceivedThisMonth: Number(monthInwardRow.total),
            stockOutwardThisMonth: Number(monthOutwardRow.total),
            lowStockCount,
            totalStockValue: valuation.grandTotalValue,
            productSummary: summary,
            warehouseBreakdown
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Product-wise stock summary
router.get('/summary', (req, res) => {
    try {
        const summary = getStockSummary();
        res.json({ summary });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Chronological Stock Ledger (Accounting Style)
router.get('/ledger', (req, res) => {
    try {
        const { productId, warehouseId, millId, transactionType, startDate, endDate, search } = req.query;
        const targetFacilityId = millId || warehouseId;

        let sql = `
            SELECT 
                sl.*,
                p.name as product_name,
                p.code as product_code,
                p.variety as product_variety,
                p.unit as product_unit,
                COALESCE(ind.name, w.name, 'Mill Facility') as warehouse_name,
                COALESCE(ind.name, w.name, 'Mill Facility') as mill_name
            FROM stock_ledger sl
            JOIN products p ON sl.product_id = p.id
            LEFT JOIN industries ind ON sl.warehouse_id = ind.id
            LEFT JOIN warehouses w ON sl.warehouse_id = w.id
            WHERE 1=1
        `;

        const params = [];
        if (productId) {
            sql += ' AND sl.product_id = ?';
            params.push(productId);
        }
        if (targetFacilityId) {
            sql += ' AND sl.warehouse_id = ?';
            params.push(targetFacilityId);
        }
        if (transactionType) {
            sql += ' AND sl.transaction_type = ?';
            params.push(transactionType);
        }
        if (startDate) {
            sql += ' AND sl.date >= ?';
            params.push(startDate);
        }
        if (endDate) {
            sql += ' AND sl.date <= ?';
            params.push(endDate);
        }
        if (search) {
            sql += ' AND (sl.transaction_number LIKE ? OR sl.reference_number LIKE ? OR sl.source LIKE ? OR sl.destination LIKE ? OR p.name LIKE ?)';
            const q = `%${search}%`;
            params.push(q, q, q, q, q);
        }

        sql += ' ORDER BY sl.date DESC, sl.id DESC';

        const rows = query(sql, params);
        res.json({ ledger: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Record Stock Inward (Purchases from mills, replenishment, customer returns, opening balance)
router.post('/inward', (req, res) => {
    try {
        const { date, productId, warehouseId, millId, quantity, rate, transactionType, source, referenceNumber, remarks } = req.body;
        const targetFacilityId = millId || warehouseId;
        if (!productId || !targetFacilityId || !quantity) {
            return res.status(400).json({ error: 'Product, mill, and quantity are required' });
        }

        const mill = get('SELECT name FROM industries WHERE id = ?', [targetFacilityId]);
        const wh = get('SELECT id FROM warehouses WHERE id = ?', [targetFacilityId]);
        const safeWarehouseId = wh ? wh.id : null;

        const result = recordInward({
            date: date || new Date().toISOString().split('T')[0],
            productId: Number(productId),
            warehouseId: safeWarehouseId,
            quantity: Number(quantity),
            rate: 0, // Purchase inward rate removed as requested
            transactionType: transactionType || 'Purchase Inward',
            source: source || (mill ? mill.name : 'Supplier Mill / Procurement'),
            referenceNumber,
            remarks
        });

        logAction('StockLedger', result.transactionNumber, 'INWARD', req.user?.username || 'Staff', { productId, quantity, warehouseId: targetFacilityId });
        res.status(201).json({ success: true, result, message: 'Stock inward recorded successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET all Stock Outward records (combines Customer Dispatches from Loading Register and manual issues from Stock Ledger)
router.get('/outwards', (req, res) => {
    try {
        const { startDate, endDate, productId, search } = req.query;

        let dispatchSql = `
            SELECT 
                d.id,
                d.dispatch_number as reference_number,
                d.dispatch_number,
                d.dispatch_date as date,
                'Customer Dispatch' as transaction_type,
                d.dispatch_quantity as quantity,
                d.dispatch_quantity as outward_quantity,
                d.vehicle_number,
                d.driver_phone,
                d.source_type,
                COALESCE(w.name, ind.name, 'Mill Facility') as source,
                COALESCE(pso.buyer_name, c.name, 'Customer') as destination,
                c.name as customer_name,
                pso.buyer_name,
                po.po_number,
                le.sub_order_no,
                p.id as product_id,
                p.name as product_name,
                p.code as product_code,
                le.purchase_rate as rate,
                ROUND(d.dispatch_quantity * COALESCE(le.purchase_rate, 0), 2) as amount,
                le.loading_number,
                d.remarks,
                d.created_at
            FROM dispatches d
            JOIN loading_entries le ON d.loading_id = le.id
            JOIN purchase_orders po ON d.po_id = po.id
            JOIN customers c ON po.customer_id = c.id
            JOIN products p ON le.product_id = p.id
            LEFT JOIN warehouses w ON d.warehouse_id = w.id
            LEFT JOIN industries ind ON le.industry_id = ind.id
            LEFT JOIN po_sub_orders pso ON (le.sub_order_id = pso.id OR (le.sub_order_no = pso.sub_order_no AND le.po_id = pso.po_id))
            WHERE le.loading_status != 'Cancelled'
        `;

        let ledgerSql = `
            SELECT 
                sl.id,
                sl.transaction_number as reference_number,
                sl.reference_number as dispatch_number,
                sl.date,
                sl.transaction_type,
                sl.outward_quantity as quantity,
                sl.outward_quantity,
                '' as vehicle_number,
                '' as driver_phone,
                'Warehouse' as source_type,
                COALESCE(sl.source, w.name, ind.name, 'Mill Facility') as source,
                sl.destination,
                sl.destination as customer_name,
                '' as buyer_name,
                '' as po_number,
                '' as sub_order_no,
                p.id as product_id,
                p.name as product_name,
                p.code as product_code,
                sl.rate,
                sl.amount,
                sl.reference_number as loading_number,
                sl.remarks,
                sl.created_at
            FROM stock_ledger sl
            JOIN products p ON sl.product_id = p.id
            LEFT JOIN warehouses w ON sl.warehouse_id = w.id
            LEFT JOIN industries ind ON sl.warehouse_id = ind.id
            WHERE sl.outward_quantity > 0 
              AND sl.reference_number NOT IN (SELECT dispatch_number FROM dispatches WHERE dispatch_number IS NOT NULL)
        `;

        const params1 = [];
        const params2 = [];
        if (startDate) {
            dispatchSql += ' AND d.dispatch_date >= ?';
            params1.push(startDate);
            ledgerSql += ' AND sl.date >= ?';
            params2.push(startDate);
        }
        if (endDate) {
            dispatchSql += ' AND d.dispatch_date <= ?';
            params1.push(endDate);
            ledgerSql += ' AND sl.date <= ?';
            params2.push(endDate);
        }
        if (productId) {
            dispatchSql += ' AND p.id = ?';
            params1.push(productId);
            ledgerSql += ' AND p.id = ?';
            params2.push(productId);
        }

        const dispatches = query(dispatchSql, params1);
        const manualOutwards = query(ledgerSql, params2);
        let allOutwards = [...dispatches, ...manualOutwards].sort((a, b) => new Date(b.date) - new Date(a.date) || b.id - a.id);

        if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            allOutwards = allOutwards.filter(o => 
                o.dispatch_number?.toLowerCase().includes(q) ||
                o.po_number?.toLowerCase().includes(q) ||
                o.sub_order_no?.toLowerCase().includes(q) ||
                o.customer_name?.toLowerCase().includes(q) ||
                o.buyer_name?.toLowerCase().includes(q) ||
                o.destination?.toLowerCase().includes(q) ||
                o.product_name?.toLowerCase().includes(q) ||
                o.vehicle_number?.toLowerCase().includes(q) ||
                o.loading_number?.toLowerCase().includes(q) ||
                o.remarks?.toLowerCase().includes(q)
            );
        }

        const today = new Date().toISOString().split('T')[0];
        const currentMonth = today.substring(0, 7);
        const todayQtl = allOutwards.filter(o => o.date === today).reduce((sum, o) => sum + Number(o.quantity || 0), 0);
        const monthQtl = allOutwards.filter(o => o.date && o.date.startsWith(currentMonth)).reduce((sum, o) => sum + Number(o.quantity || 0), 0);
        const totalQtl = allOutwards.reduce((sum, o) => sum + Number(o.quantity || 0), 0);

        res.json({
            outwards: allOutwards,
            summary: {
                todayQtl: Number(todayQtl.toFixed(2)),
                monthQtl: Number(monthQtl.toFixed(2)),
                totalQtl: Number(totalQtl.toFixed(2)),
                totalCount: allOutwards.length
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Record Stock Outward (Customer dispatch, internal issue)
router.post('/outward', (req, res) => {
    try {
        const { date, productId, warehouseId, millId, quantity, rate, transactionType, destination, referenceNumber, remarks } = req.body;
        const targetFacilityId = millId || warehouseId;
        if (!productId || !targetFacilityId || !quantity) {
            return res.status(400).json({ error: 'Product, mill, and quantity are required' });
        }

        const wh = get('SELECT id FROM warehouses WHERE id = ?', [targetFacilityId]);
        const safeWarehouseId = wh ? wh.id : null;

        const available = getAvailableStock(Number(productId), safeWarehouseId);
        if (available < Number(quantity)) {
            return res.status(400).json({
                error: `Insufficient available stock! Available in selected facility: ${available} QTL. Attempted outward: ${quantity} QTL.`
            });
        }

        const result = recordOutward({
            date: date || new Date().toISOString().split('T')[0],
            productId: Number(productId),
            warehouseId: safeWarehouseId,
            quantity: Number(quantity),
            rate: Number(rate || 0),
            transactionType: transactionType || 'Internal Stock Issue',
            destination: destination || 'Internal Distribution',
            referenceNumber,
            remarks
        });

        logAction('StockLedger', result.transactionNumber, 'OUTWARD', req.user?.username || 'Staff', { productId, quantity, warehouseId: targetFacilityId });
        res.status(201).json({ success: true, result, message: 'Stock outward recorded successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reserve Stock (Decommissioned: safe stub)
router.post('/reserve', (req, res) => {
    res.json({ success: true, message: 'Stock reservation system is decommissioned' });
});

// Release Reservation (Decommissioned: safe stub)
router.post('/release-reservation', (req, res) => {
    res.json({ success: true, message: 'Stock reservation system is decommissioned' });
});

// Inter-Mill / Warehouse Stock Transfer
router.post('/transfer', (req, res) => {
    try {
        const { date, productId, sourceWarehouseId, sourceMillId, destWarehouseId, destMillId, quantity, vehicleNumber, remarks } = req.body;
        const fromId = sourceMillId || sourceWarehouseId;
        const toId = destMillId || destWarehouseId;
        if (!productId || !fromId || !toId || !quantity) {
            return res.status(400).json({ error: 'Product, source mill, destination mill, and quantity are required' });
        }

        const result = transferStock({
            date: date || new Date().toISOString().split('T')[0],
            productId: Number(productId),
            sourceWarehouseId: Number(fromId),
            destWarehouseId: Number(toId),
            quantity: Number(quantity),
            vehicleNumber,
            remarks,
            createdBy: req.user?.fullName || 'Staff'
        });

        logAction('StockTransfer', result.transferNumber, 'TRANSFER', req.user?.username || 'Staff', { quantity, source: result.source, dest: result.destination });
        res.status(201).json({ success: true, result, message: 'Inter-mill stock transfer completed successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Stock Adjustments (Physical count reconciliation)
router.post('/adjust', (req, res) => {
    try {
        const { date, productId, warehouseId, millId, physicalStock, reason, authorizedBy } = req.body;
        const targetFacilityId = millId || warehouseId;
        if (!productId || !targetFacilityId || physicalStock === undefined || !reason) {
            return res.status(400).json({ error: 'Product, mill, physical stock count, and reason are required' });
        }

        const result = adjustStock({
            date: date || new Date().toISOString().split('T')[0],
            productId: Number(productId),
            warehouseId: Number(targetFacilityId),
            physicalStock: Number(physicalStock),
            reason,
            authorizedBy: authorizedBy || req.user?.fullName || 'Admin'
        });

        logAction('StockAdjustment', result.adjustmentNumber || 'ADJUST', 'ADJUSTMENT', req.user?.username || 'Staff', { difference: result.difference, reason });
        res.status(201).json({ success: true, result, message: 'Stock adjustment recorded successfully in audited ledger' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Stock Valuation (Weighted Average Cost)
router.get('/valuation', (req, res) => {
    try {
        const valuation = getStockValuation();
        res.json(valuation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

