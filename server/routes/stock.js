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

        // Warehouse level breakdown
        const warehouses = query('SELECT * FROM warehouses WHERE active = 1');
        const warehouseBreakdown = warehouses.map(w => {
            const row = get(`
                SELECT COALESCE(SUM(inward_quantity - outward_quantity), 0) as stock
                FROM stock_ledger
                WHERE warehouse_id = ?
            `, [w.id]);
            const occupied = Math.max(0, Number(row?.stock || 0));
            return {
                warehouseId: w.id,
                warehouseName: w.name,
                location: w.location,
                capacityQtl: w.capacity_qtl,
                occupiedQtl: occupied,
                utilizationPct: w.capacity_qtl > 0 ? Number(((occupied / w.capacity_qtl) * 100).toFixed(1)) : 0
            };
        });

        res.json({
            totalPhysicalStock: valuation.grandTotalStock,
            totalReservedStock: summary.reduce((s, r) => s + r.reservedQuantity, 0),
            totalAvailableStock: summary.reduce((s, r) => s + r.availableQuantity, 0),
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
        const { productId, warehouseId, transactionType, startDate, endDate, search } = req.query;

        let sql = `
            SELECT 
                sl.*,
                p.name as product_name,
                p.code as product_code,
                p.variety as product_variety,
                p.unit as product_unit,
                w.name as warehouse_name
            FROM stock_ledger sl
            JOIN products p ON sl.product_id = p.id
            LEFT JOIN warehouses w ON sl.warehouse_id = w.id
            WHERE 1=1
        `;

        const params = [];
        if (productId) {
            sql += ' AND sl.product_id = ?';
            params.push(productId);
        }
        if (warehouseId) {
            sql += ' AND sl.warehouse_id = ?';
            params.push(warehouseId);
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
        const { date, productId, warehouseId, quantity, rate, transactionType, source, referenceNumber, remarks } = req.body;
        if (!productId || !warehouseId || !quantity) {
            return res.status(400).json({ error: 'Product, warehouse, and quantity are required' });
        }

        const result = recordInward({
            date: date || new Date().toISOString().split('T')[0],
            productId: Number(productId),
            warehouseId: Number(warehouseId),
            quantity: Number(quantity),
            rate: Number(rate || 0),
            transactionType: transactionType || 'Stock Replenished',
            source: source || 'Supplier Mill / Procurement',
            referenceNumber,
            remarks
        });

        logAction('StockLedger', result.transactionNumber, 'INWARD', req.user?.username || 'Staff', { productId, quantity, warehouseId });
        res.status(201).json({ success: true, result, message: 'Stock inward recorded successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Record Stock Outward (Customer dispatch, internal issue)
router.post('/outward', (req, res) => {
    try {
        const { date, productId, warehouseId, quantity, rate, transactionType, destination, referenceNumber, remarks } = req.body;
        if (!productId || !warehouseId || !quantity) {
            return res.status(400).json({ error: 'Product, warehouse, and quantity are required' });
        }

        const available = getAvailableStock(Number(productId), Number(warehouseId));
        if (available < Number(quantity)) {
            return res.status(400).json({
                error: `Insufficient available stock! Available in selected godown: ${available} QTL. Attempted outward: ${quantity} QTL.`
            });
        }

        const result = recordOutward({
            date: date || new Date().toISOString().split('T')[0],
            productId: Number(productId),
            warehouseId: Number(warehouseId),
            quantity: Number(quantity),
            rate: Number(rate || 0),
            transactionType: transactionType || 'Internal Stock Issue',
            destination: destination || 'Internal Distribution',
            referenceNumber,
            remarks
        });

        logAction('StockLedger', result.transactionNumber, 'OUTWARD', req.user?.username || 'Staff', { productId, quantity, warehouseId });
        res.status(201).json({ success: true, result, message: 'Stock outward recorded successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reserve Stock for a Customer PO
router.post('/reserve', (req, res) => {
    try {
        const { poId, productId, warehouseId, quantity } = req.body;
        if (!poId || !productId || !quantity) {
            return res.status(400).json({ error: 'PO, product, and quantity are required' });
        }

        const result = reserveStock(Number(poId), Number(productId), warehouseId ? Number(warehouseId) : null, Number(quantity));
        logAction('StockReservation', result.reservationId, 'RESERVE', req.user?.username || 'Staff', { poId, quantity });
        res.status(201).json({ success: true, result, message: 'Stock reserved successfully for PO' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Release Reservation
router.post('/release-reservation', (req, res) => {
    try {
        const { poId, productId, quantity } = req.body;
        if (!poId || !productId || !quantity) {
            return res.status(400).json({ error: 'PO, product, and quantity are required' });
        }

        const result = releaseReservation(Number(poId), Number(productId), Number(quantity));
        logAction('StockReservation', poId, 'RELEASE', req.user?.username || 'Staff', { quantity });
        res.json({ success: true, result, message: 'Stock reservation released successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Inter-warehouse Stock Transfer
router.post('/transfer', (req, res) => {
    try {
        const { date, productId, sourceWarehouseId, destWarehouseId, quantity, vehicleNumber, remarks } = req.body;
        if (!productId || !sourceWarehouseId || !destWarehouseId || !quantity) {
            return res.status(400).json({ error: 'Product, source warehouse, destination warehouse, and quantity are required' });
        }

        const result = transferStock({
            date: date || new Date().toISOString().split('T')[0],
            productId: Number(productId),
            sourceWarehouseId: Number(sourceWarehouseId),
            destWarehouseId: Number(destWarehouseId),
            quantity: Number(quantity),
            vehicleNumber,
            remarks,
            createdBy: req.user?.fullName || 'Staff'
        });

        logAction('StockTransfer', result.transferNumber, 'TRANSFER', req.user?.username || 'Staff', { quantity, source: result.source, dest: result.destination });
        res.status(201).json({ success: true, result, message: 'Inter-warehouse stock transfer completed successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Stock Adjustments (Physical count reconciliation)
router.post('/adjust', (req, res) => {
    try {
        const { date, productId, warehouseId, physicalStock, reason, authorizedBy } = req.body;
        if (!productId || !warehouseId || physicalStock === undefined || !reason) {
            return res.status(400).json({ error: 'Product, warehouse, physical stock count, and reason are required' });
        }

        const result = adjustStock({
            date: date || new Date().toISOString().split('T')[0],
            productId: Number(productId),
            warehouseId: Number(warehouseId),
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
