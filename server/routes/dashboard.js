// server/routes/dashboard.js
const express = require('express');
const router = express.Router();
const { query, get } = require('../db');
const { getStockValuation, getStockSummary } = require('../services/stockService');

router.get('/', (req, res) => {
    try {
        // 1. Core Operational Quantities calculated directly from database records
        const poStats = get(`
            SELECT 
                COUNT(id) as total_pos,
                COALESCE(SUM(ordered_quantity), 0) as total_ordered_qtl,
                COALESCE(SUM(ordered_quantity * customer_selling_rate), 0) as total_order_value
            FROM purchase_orders
            WHERE status != 'Cancelled'
        `);

        const allocStats = get(`
            SELECT 
                COALESCE(SUM(allocated_quantity), 0) as total_allocated_qtl,
                COALESCE(SUM(purchase_amount), 0) as total_alloc_amount
            FROM industry_allocations
            WHERE status != 'Cancelled'
        `);

        const loadStats = get(`
            SELECT 
                COALESCE(SUM(loading_quantity), 0) as total_loaded_qtl,
                COALESCE(SUM(loading_amount), 0) as total_load_amount,
                COUNT(id) as total_loadings
            FROM loading_entries
            WHERE loading_status != 'Cancelled'
        `);

        const dspStats = get(`
            SELECT 
                COALESCE(SUM(dispatch_quantity), 0) as total_dispatched_qtl,
                COUNT(id) as total_dispatches
            FROM dispatches
        `);

        const totalOrdered = Number(poStats.total_ordered_qtl);
        const totalAllocated = Number(allocStats.total_allocated_qtl);
        const totalLoaded = Number(loadStats.total_loaded_qtl);
        const totalDispatched = Number(dspStats.total_dispatched_qtl);

        const pendingLoading = Math.max(0, totalAllocated - totalLoaded);
        const pendingDispatch = Math.max(0, totalLoaded - totalDispatched);
        const overallPendingFulfillment = Math.max(0, totalOrdered - totalDispatched);

        // 2. Stock metrics
        const valuation = getStockValuation();
        const summary = getStockSummary();
        const lowStockProducts = summary.filter(p => p.isLowStock);

        // 3. Daily loading summary (last 7 active days)
        const dailyLoading = query(`
            SELECT 
                loading_date as date,
                SUM(loading_quantity) as loaded_qtl,
                COUNT(id) as entries
            FROM loading_entries
            WHERE loading_status != 'Cancelled'
            GROUP BY loading_date
            ORDER BY loading_date DESC
            LIMIT 7
        `).reverse();

        // 4. Daily dispatch summary (last 7 active days)
        const dailyDispatch = query(`
            SELECT 
                dispatch_date as date,
                SUM(dispatch_quantity) as dispatched_qtl,
                COUNT(id) as count
            FROM dispatches
            GROUP BY dispatch_date
            ORDER BY dispatch_date DESC
            LIMIT 7
        `).reverse();

        // 5. Industry-wise loading distribution
        const industryDistribution = query(`
            SELECT 
                i.name as industry_name,
                COALESCE(SUM(le.loading_quantity), 0) as total_loaded_qtl,
                COALESCE(SUM(le.loading_amount), 0) as total_amount
            FROM industries i
            LEFT JOIN loading_entries le ON i.id = le.industry_id AND le.loading_status != 'Cancelled'
            GROUP BY i.id
            HAVING total_loaded_qtl > 0
            ORDER BY total_loaded_qtl DESC
        `);

        // 6. Product-wise stock distribution
        const productDistribution = summary.map(p => ({
            name: p.productName,
            code: p.productCode,
            physicalStock: p.physicalBalance,
            availableStock: p.physicalBalance,
            reservedStock: 0
        }));

        // 7. Recent operational activity (Audit logs)
        const recentActivities = query(`
            SELECT * FROM audit_logs
            ORDER BY id DESC LIMIT 10
        `);

        // 8. Pending operational tasks
        const pendingPOs = query(`
            SELECT po.id, po.po_number, COALESCE(c.name, po.customer_name_text, 'Designated Buyer') as customer_name, po.ordered_quantity, po.po_date, po.status
            FROM purchase_orders po
            LEFT JOIN customers c ON po.customer_id = c.id
            WHERE po.status IN ('New', 'Allocation Pending', 'Partially Allocated')
            ORDER BY po.po_date ASC LIMIT 5
        `);

        const pendingDispatchLoadings = query(`
            SELECT 
                le.id, le.loading_number, le.loading_date, le.loading_quantity,
                po.po_number, COALESCE(c.name, po.customer_name_text, 'Designated Buyer') as customer_name, le.vehicle_number,
                (le.loading_quantity - COALESCE(SUM(d.dispatch_quantity), 0)) as pending_dispatch_qtl
            FROM loading_entries le
            JOIN purchase_orders po ON le.po_id = po.id
            LEFT JOIN customers c ON po.customer_id = c.id
            LEFT JOIN dispatches d ON le.id = d.loading_id
            WHERE le.loading_status = 'Loaded'
            GROUP BY le.id
            HAVING pending_dispatch_qtl > 0
            ORDER BY le.loading_date ASC LIMIT 5
        `);

        res.json({
            metrics: {
                totalPurchaseOrders: poStats.total_pos,
                totalOrderedQuantity: totalOrdered,
                totalAllocatedQuantity: totalAllocated,
                totalLoadedQuantity: totalLoaded,
                totalDispatchedQuantity: totalDispatched,
                pendingLoading,
                pendingDispatch,
                overallPendingFulfillment,
                totalPhysicalStock: valuation.grandTotalStock,
                totalReservedStock: 0,
                totalAvailableStock: valuation.grandTotalStock,
                totalStockValue: valuation.grandTotalValue,
                totalOrderValue: Number(poStats.total_order_value)
            },
            dailyLoading,
            dailyDispatch,
            industryDistribution,
            productDistribution,
            lowStockProducts,
            recentActivities,
            pendingTasks: {
                unallocatedPOs: pendingPOs,
                undispatchedLoadings: pendingDispatchLoadings
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

