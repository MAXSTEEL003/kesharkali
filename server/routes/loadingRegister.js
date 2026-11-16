// server/routes/loadingRegister.js
const express = require('express');
const router = express.Router();
const { query, get, run, transaction } = require('../db');
const { recordInward } = require('../services/stockService');
const { derivePOStatus } = require('./purchaseOrders');
const { logAction } = require('../services/auditService');
const { pushReverseUpdateToOrdersPortal } = require('./integration');
const { sendDispatchNotification } = require('../services/whatsappService');

function generateLoadingNumber(offset = 0) {
    const year = new Date().getFullYear();
    const last = get(`
        SELECT loading_number FROM loading_entries 
        WHERE loading_number LIKE ? 
        ORDER BY id DESC LIMIT 1
    `, [`LD-${year}-%`]);

    let seq = 1;
    if (last && last.loading_number) {
        const parts = last.loading_number.split('-');
        const parsed = parseInt(parts[2], 10);
        if (!isNaN(parsed)) {
            seq = parsed + 1;
        }
    }
    return `LD-${year}-${String(seq + offset).padStart(3, '0')}`;
}

function generateDispatchNumber(offset = 0) {
    const year = new Date().getFullYear();
    const last = get(`
        SELECT dispatch_number FROM dispatches 
        WHERE dispatch_number LIKE ? 
        ORDER BY id DESC LIMIT 1
    `, [`DSP-${year}-%`]);

    let seq = 1;
    if (last && last.dispatch_number) {
        const parts = last.dispatch_number.split('-');
        const parsed = parseInt(parts[2], 10);
        if (!isNaN(parsed)) {
            seq = parsed + 1;
        }
    }
    return `DSP-${year}-${String(seq + offset).padStart(3, '0')}`;
}

// GET Master Loading Register entries with rich join filters
router.get('/', (req, res) => {
    try {
        const {
            startDate,
            endDate,
            buyerId,
            industryId,
            poId,
            productId,
            vehicleNumber,
            loadingStatus,
            dispatchStatus,
            search
        } = req.query;

        let sql = `
            SELECT 
                le.*,
                po.po_number,
                po.customer_selling_rate,
                po.ordered_quantity as po_ordered_quantity,
                c.id as customer_id,
                COALESCE(pso.buyer_name, c.name) as customer_name,
                pso.buyer_name as sub_buyer_name,
                pso.ordered_quantity as sub_ordered_quantity,
                pso.loaded_quantity as sub_loaded_quantity,
                i.name as industry_name,
                i.location as industry_location,
                i.is_default as is_default_partner,
                p.name as product_name,
                p.code as product_code,
                p.unit as product_unit,
                w.name as warehouse_name,
                COALESCE(dsp_stats.total_dispatched, 0) as dispatched_quantity,
                MAX(0, le.loading_quantity - COALESCE(dsp_stats.total_dispatched, 0)) as available_to_dispatch
            FROM loading_entries le
            JOIN purchase_orders po ON le.po_id = po.id
            JOIN customers c ON po.customer_id = c.id
            JOIN industries i ON le.industry_id = i.id
            JOIN products p ON le.product_id = p.id
            LEFT JOIN po_sub_orders pso ON (le.sub_order_id = pso.id OR (le.po_id = pso.po_id AND le.sub_order_no = pso.sub_order_no))
            LEFT JOIN warehouses w ON le.warehouse_id = w.id
            LEFT JOIN (
                SELECT 
                    loading_id,
                    SUM(dispatch_quantity) as total_dispatched
                FROM dispatches
                GROUP BY loading_id
            ) dsp_stats ON le.id = dsp_stats.loading_id
            WHERE 1=1
        `;

        const params = [];
        if (req.user && req.user.role === 'Supplier' && req.user.supplierId) {
            sql += ' AND le.industry_id = ?';
            params.push(req.user.supplierId);
        }
        if (startDate) {
            sql += ' AND le.loading_date >= ?';
            params.push(startDate);
        }
        if (endDate) {
            sql += ' AND le.loading_date <= ?';
            params.push(endDate);
        }
        if (buyerId) {
            sql += ' AND (po.customer_id = ? OR pso.buyer_name = (SELECT name FROM customers WHERE id = ?))';
            params.push(buyerId, buyerId);
        }
        if (industryId) {
            sql += ' AND le.industry_id = ?';
            params.push(industryId);
        }
        if (poId) {
            sql += ' AND le.po_id = ?';
            params.push(poId);
        }
        if (productId) {
            sql += ' AND le.product_id = ?';
            params.push(productId);
        }
        if (vehicleNumber) {
            sql += ' AND le.vehicle_number LIKE ?';
            params.push(`%${vehicleNumber}%`);
        }
        if (loadingStatus) {
            sql += ' AND le.loading_status = ?';
            params.push(loadingStatus);
        }
        if (dispatchStatus) {
            sql += ' AND le.dispatch_status = ?';
            params.push(dispatchStatus);
        }
        if (search) {
            sql += ` AND (
                le.loading_number LIKE ? 
                OR po.po_number LIKE ? 
                OR c.name LIKE ? 
                OR i.name LIKE ? 
                OR le.vehicle_number LIKE ?
                OR le.sub_order_no LIKE ?
                OR pso.buyer_name LIKE ?
                OR p.name LIKE ?
                OR le.loading_location LIKE ?
                OR le.remarks LIKE ?
            )`;
            const q = `%${search}%`;
            params.push(q, q, q, q, q, q, q, q, q, q);
        }

        sql += ' ORDER BY le.loading_date DESC, le.id DESC';

        const rows = query(sql, params);
        res.json({ loadingEntries: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET Summary metrics for Master Loading Register dashboard strip
router.get('/summary', (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        // Today's loading
        const todayLoad = get(`
            SELECT COALESCE(SUM(loading_quantity), 0) as qtl, COALESCE(SUM(loading_amount), 0) as amount, COUNT(id) as count
            FROM loading_entries
            WHERE loading_date = ? AND loading_status != 'Cancelled'
        `, [today]);

        // Total loading
        const totalLoad = get(`
            SELECT COALESCE(SUM(loading_quantity), 0) as qtl, COALESCE(SUM(loading_amount), 0) as amount, COUNT(id) as count
            FROM loading_entries
            WHERE loading_status != 'Cancelled'
        `);

        // Pending loading across all active allocations
        const pendingLoad = get(`
            SELECT 
                MAX(0, COALESCE(SUM(ia.allocated_quantity), 0) - COALESCE(SUM(le_sub.loaded), 0)) as pending_qtl
            FROM industry_allocations ia
            LEFT JOIN (
                SELECT allocation_id, SUM(loading_quantity) as loaded
                FROM loading_entries
                WHERE loading_status != 'Cancelled'
                GROUP BY allocation_id
            ) le_sub ON ia.id = le_sub.allocation_id
            WHERE ia.status != 'Cancelled'
        `);

        // Today's dispatch
        const todayDispatch = get(`
            SELECT COALESCE(SUM(dispatch_quantity), 0) as qtl, COUNT(id) as count
            FROM dispatches
            WHERE dispatch_date = ?
        `, [today]);

        res.json({
            todayLoading: { qtl: Number(todayLoad.qtl), amount: Number(todayLoad.amount), count: todayLoad.count },
            totalLoading: { qtl: Number(totalLoad.qtl), amount: Number(totalLoad.amount), count: totalLoad.count },
            pendingLoading: { qtl: Number(pendingLoad.pending_qtl || 0) },
            todayDispatch: { qtl: Number(todayDispatch.qtl), count: todayDispatch.count }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Loading Entry (Single or Bulk Multi-Sub-Order)
router.post('/', (req, res) => {
    try {
        // Bulk Multi-Sub-Order Truck Loading
        if (req.body.items && Array.isArray(req.body.items) && req.body.items.length > 0) {
            const {
                industry_id,
                loading_date,
                fulfillment_type = 'Direct',
                warehouse_id,
                loading_location,
                vehicle_number,
                driver_phone,
                remarks,
                items
            } = req.body;

            if (!industry_id || !vehicle_number || items.length === 0) {
                return res.status(400).json({ error: 'Industry, vehicle number, and at least one sub-order item are required' });
            }

            if (fulfillment_type === 'Warehouse' && !warehouse_id) {
                return res.status(400).json({ error: 'Warehouse must be selected when fulfillment type is Warehouse.' });
            }

            const validatedItems = [];
            for (const it of items) {
                const poId = it.po_id || it.poId;
                const po = get('SELECT * FROM purchase_orders WHERE id = ?', [poId]);
                if (!po) {
                    return res.status(404).json({ error: `Purchase Order ID ${poId} not found` });
                }

                const loadQty = Number(it.loading_quantity || it.loadQty);
                if (!loadQty || loadQty <= 0) {
                    return res.status(400).json({ error: `Invalid loading quantity for sub-order ${it.sub_order_no || it.subOrderNo}` });
                }

                const subNo = it.sub_order_no || it.subOrderNo;
                const subId = it.sub_order_id || it.subOrderId;
                let subOrder = null;
                if (subId) {
                    subOrder = get('SELECT * FROM po_sub_orders WHERE id = ?', [subId]);
                } else if (subNo) {
                    subOrder = get('SELECT * FROM po_sub_orders WHERE po_id = ? AND sub_order_no = ?', [poId, subNo]);
                }

                // Sub-order overload check
                if (subOrder) {
                    const subAlreadyLoaded = Number(subOrder.loaded_quantity || 0);
                    const subOrderedQty = Number(subOrder.ordered_quantity || 0);
                    if (subAlreadyLoaded + loadQty > subOrderedQty && !it.override_allowed && !req.body.override_allowed) {
                        return res.status(400).json({
                            error: `Overloading not permitted: Sub-Order ${subOrder.sub_order_no} (${subOrder.buyer_name}) has ordered ${subOrderedQty} QTL. Already loaded: ${subAlreadyLoaded} QTL. Adding ${loadQty} QTL exceeds sub-order quantity by ${(subAlreadyLoaded + loadQty - subOrderedQty).toFixed(2)} QTL.`
                        });
                    }
                }

                // PO overload check
                const existingLoadedRow = get("SELECT COALESCE(SUM(loading_quantity), 0) as total FROM loading_entries WHERE po_id = ? AND loading_status != 'Cancelled'", [poId]);
                const currentlyLoaded = Number(existingLoadedRow?.total || 0);
                const orderQty = Number(po.ordered_quantity);

                if (currentlyLoaded + loadQty > orderQty && !it.override_allowed && !req.body.override_allowed) {
                    return res.status(400).json({
                        error: `Overloading not permitted: PO ${po.po_number} requires ${orderQty} QTL. Current loaded is ${currentlyLoaded} QTL. Adding ${loadQty} QTL exceeds total by ${(currentlyLoaded + loadQty - orderQty)} QTL.`
                    });
                }

                const rate = Number(it.purchase_rate !== undefined && it.purchase_rate !== null && it.purchase_rate !== ''
                    ? it.purchase_rate
                    : (it.purchaseRate !== undefined && it.purchaseRate !== null && it.purchaseRate !== ''
                        ? it.purchaseRate
                        : (req.body.purchase_rate !== undefined && req.body.purchase_rate !== null && req.body.purchase_rate !== ''
                            ? req.body.purchase_rate
                            : 0)));
                const amount = Number((loadQty * rate).toFixed(2));
                const prodId = it.product_id || it.productId || po.product_id;

                validatedItems.push({
                    po,
                    subOrder,
                    loadQty,
                    rate,
                    amount,
                    prodId,
                    subNo: subOrder?.sub_order_no || subNo || null,
                    subId: subOrder?.id || subId || null,
                    location: it.loading_location || loading_location || subOrder?.delivery_location || po.delivery_location || ''
                });
            }

            const date = loading_date || new Date().toISOString().split('T')[0];
            const createdEntries = [];
            const createdDispatchIds = [];
            const affectedPoIds = new Set();

            transaction((db) => {
                const insertStmt = db.prepare(`
                    INSERT INTO loading_entries (
                        loading_number, loading_date, po_id, sub_order_no, sub_order_id, allocation_id,
                        industry_id, product_id, fulfillment_type, warehouse_id,
                        loading_location, vehicle_number, driver_phone, loading_quantity,
                        purchase_rate, loading_amount, loading_status, dispatch_status,
                        remarks, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Loaded', 'Dispatched', ?, ?)
                `);

                const dspStmt = db.prepare(`
                    INSERT INTO dispatches (
                        dispatch_number, loading_id, po_id, dispatch_date,
                        dispatch_quantity, vehicle_number, driver_phone, source_type,
                        warehouse_id, remarks, notification_status, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)
                `);

                for (let i = 0; i < validatedItems.length; i++) {
                    const item = validatedItems[i];
                    const loadingNumber = generateLoadingNumber(i);
                    const resInsert = insertStmt.run(
                        loadingNumber,
                        date,
                        item.po.id,
                        item.subNo,
                        item.subId,
                        null,
                        industry_id,
                        item.prodId,
                        fulfillment_type,
                        fulfillment_type === 'Warehouse' ? warehouse_id : null,
                        item.location,
                        vehicle_number.toUpperCase().trim(),
                        driver_phone || null,
                        item.loadQty,
                        item.rate,
                        item.amount,
                        remarks || '',
                        req.user?.fullName || 'Staff'
                    );

                    const newLoadingId = resInsert.lastInsertRowid;
                    createdEntries.push({ id: newLoadingId, loadingNumber, loading_number: loadingNumber, poId: item.po.id });
                    affectedPoIds.add(item.po.id);

                    // Loaded itself means dispatched: auto-record dispatch
                    const dispatchNumber = generateDispatchNumber(i);
                    const dspRes = dspStmt.run(
                        dispatchNumber,
                        newLoadingId,
                        item.po.id,
                        date,
                        item.loadQty,
                        vehicle_number.toUpperCase().trim(),
                        driver_phone || null,
                        fulfillment_type,
                        fulfillment_type === 'Warehouse' ? warehouse_id : null,
                        remarks || '',
                        req.user?.fullName || 'Staff'
                    );
                    createdDispatchIds.push(dspRes.lastInsertRowid);

                    // Update sub-order loaded_quantity & status
                    if (item.subOrder) {
                        const newSubLoaded = Number(item.subOrder.loaded_quantity || 0) + item.loadQty;
                        const newSubStatus = newSubLoaded >= Number(item.subOrder.ordered_quantity) ? 'Loaded' : 'Partially Loaded';
                        db.prepare('UPDATE po_sub_orders SET loaded_quantity = ?, status = ? WHERE id = ?').run(newSubLoaded, newSubStatus, item.subOrder.id);

                        // Update sub_orders_json on purchase_orders
                        const currentPO = db.prepare('SELECT sub_orders_json FROM purchase_orders WHERE id = ?').get(item.po.id);
                        if (currentPO?.sub_orders_json) {
                            try {
                                const subs = JSON.parse(currentPO.sub_orders_json);
                                for (const s of subs) {
                                    if ((s.subOrderNo && s.subOrderNo === item.subOrder.sub_order_no) || (s.sub_order_no && s.sub_order_no === item.subOrder.sub_order_no)) {
                                        s.loaded_quantity = newSubLoaded;
                                        s.loadedQuantity = newSubLoaded;
                                        s.status = newSubStatus;
                                    }
                                }
                                db.prepare('UPDATE purchase_orders SET sub_orders_json = ? WHERE id = ?').run(JSON.stringify(subs), item.po.id);
                            } catch (_) {}
                        }
                    }

                    // Warehouse inward stock
                    if (fulfillment_type === 'Warehouse') {
                        const ind = db.prepare('SELECT name FROM industries WHERE id = ?').get(industry_id);
                        const wh = db.prepare('SELECT name FROM warehouses WHERE id = ?').get(warehouse_id);

                        recordInward({
                            date,
                            productId: item.prodId,
                            warehouseId: warehouse_id,
                            transactionType: 'Purchase Inward',
                            referenceNumber: loadingNumber,
                            source: ind?.name || 'Rice Mill',
                            destination: wh?.name || 'Warehouse',
                            quantity: item.loadQty,
                            rate: item.rate,
                            remarks: `Bulk Inwarded from Loading ${loadingNumber} (Vehicle: ${vehicle_number}) for Sub ${item.subNo || 'Direct'}`
                        }, db);
                    }

                    // Record in PO Ledger
                    db.prepare(`
                        INSERT INTO po_ledger (po_id, po_number, event_type, title, description, actor, metadata)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        item.po.id,
                        item.po.po_number,
                        'LOADING_ENTRY',
                        `Loading & Dispatch Recorded (${loadingNumber})`,
                        `Vehicle ${vehicle_number.toUpperCase().trim()} loaded & dispatched with ${item.loadQty} QTL for Sub ${item.subNo || 'Direct'}.`,
                        req.user?.fullName || 'Supplier Staff',
                        JSON.stringify({ loadingId: newLoadingId, vehicleNumber: vehicle_number, quantity: item.loadQty, subOrderNo: item.subNo })
                    );
                }

                // Update PO status for each affected PO
                for (const pId of affectedPoIds) {
                    const newStatus = derivePOStatus(pId);
                    db.prepare('UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, pId);
                }
            });

            // Trigger customer WhatsApp dispatch notifications asynchronously
            try {
                for (const dId of createdDispatchIds) {
                    sendDispatchNotification(dId).catch(() => {});
                }
            } catch (_) {}

            logAction('LoadingEntry', createdEntries[0]?.id, 'CREATE_BULK', req.user?.username || 'Staff', { count: createdEntries.length, vehicle_number, fulfillment_type });

            return res.status(201).json({
                success: true,
                count: createdEntries.length,
                loadingEntries: createdEntries,
                loadingNumber: createdEntries[0]?.loadingNumber,
                id: createdEntries[0]?.id,
                message: `Bulk loading created successfully (${createdEntries.length} sub-orders loaded on vehicle ${vehicle_number})`
            });
        }

        const {
            po_id,
            sub_order_no,
            sub_order_id,
            allocation_id,
            industry_id,
            product_id,
            loading_date,
            fulfillment_type = 'Warehouse',
            warehouse_id,
            loading_location,
            vehicle_number,
            driver_phone,
            loading_quantity,
            purchase_rate,
            remarks
        } = req.body;

        if (!po_id || !industry_id || !loading_quantity || purchase_rate === undefined || purchase_rate === null || purchase_rate === '' || !vehicle_number) {
            return res.status(400).json({ error: 'PO, industry, vehicle number, loading quantity, and purchase rate are required' });
        }

        if (fulfillment_type === 'Warehouse' && !warehouse_id) {
            return res.status(400).json({ error: 'Warehouse must be selected when fulfillment type is Warehouse.' });
        }

        const po = get('SELECT * FROM purchase_orders WHERE id = ?', [po_id]);
        if (!po) return res.status(404).json({ error: 'Purchase Order not found' });

        const prodId = product_id || po.product_id;
        const loadQty = Number(loading_quantity);

        // Find constituent sub-order if specified
        let subOrder = null;
        if (sub_order_id) {
            subOrder = get('SELECT * FROM po_sub_orders WHERE id = ?', [sub_order_id]);
        } else if (sub_order_no) {
            subOrder = get('SELECT * FROM po_sub_orders WHERE po_id = ? AND sub_order_no = ?', [po_id, sub_order_no]);
        }

        // Sub-order overload check: prevent loading more than the sub-order ordered quantity
        if (subOrder) {
            const subAlreadyLoaded = Number(subOrder.loaded_quantity || 0);
            const subOrderedQty = Number(subOrder.ordered_quantity || 0);
            if (subAlreadyLoaded + loadQty > subOrderedQty && !req.body.override_allowed) {
                return res.status(400).json({
                    error: `Overloading not permitted: Sub-Order ${subOrder.sub_order_no} (${subOrder.buyer_name}) has ordered ${subOrderedQty} QTL. Already loaded: ${subAlreadyLoaded} QTL. Adding ${loadQty} QTL exceeds sub-order quantity by ${(subAlreadyLoaded + loadQty - subOrderedQty).toFixed(2)} QTL.`
                });
            }
        }

        // Overload prevention check: prevent loading quantity exceeding PO ordered quantity
        const existingLoadedRow = get("SELECT COALESCE(SUM(loading_quantity), 0) as total FROM loading_entries WHERE po_id = ? AND loading_status != 'Cancelled'", [po_id]);
        const currentlyLoaded = Number(existingLoadedRow?.total || 0);
        const orderQty = Number(po.ordered_quantity);

        if (currentlyLoaded + loadQty > orderQty && !req.body.override_allowed) {
            return res.status(400).json({
                error: `Overloading not permitted: Order quantity is ${orderQty} QTL. Current loaded is ${currentlyLoaded} QTL. Adding ${loadQty} QTL exceeds total by ${(currentlyLoaded + loadQty - orderQty)} QTL. Admin approval required.`
            });
        }

        const rate = Number(purchase_rate);
        const amount = Number((loadQty * rate).toFixed(2));
        const loadingNumber = generateLoadingNumber();
        const date = loading_date || new Date().toISOString().split('T')[0];

        let newLoadingId;
        let newDispatchId;

        transaction((db) => {
            const stmt = db.prepare(`
                INSERT INTO loading_entries (
                    loading_number, loading_date, po_id, sub_order_no, sub_order_id, allocation_id,
                    industry_id, product_id, fulfillment_type, warehouse_id,
                    loading_location, vehicle_number, driver_phone, loading_quantity,
                    purchase_rate, loading_amount, loading_status, dispatch_status,
                    remarks, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Loaded', 'Dispatched', ?, ?)
            `);

            const result = stmt.run(
                loadingNumber,
                date,
                po_id,
                subOrder?.sub_order_no || sub_order_no || null,
                subOrder?.id || sub_order_id || null,
                allocation_id || null,
                industry_id,
                prodId,
                fulfillment_type,
                fulfillment_type === 'Warehouse' ? warehouse_id : null,
                loading_location || '',
                vehicle_number.toUpperCase().trim(),
                driver_phone || null,
                loadQty,
                rate,
                amount,
                remarks || '',
                req.user?.fullName || 'Staff'
            );
            newLoadingId = result.lastInsertRowid;

            // Loaded itself means dispatched: auto-record dispatch
            const dispatchNumber = generateDispatchNumber();
            const dspRes = db.prepare(`
                INSERT INTO dispatches (
                    dispatch_number, loading_id, po_id, dispatch_date,
                    dispatch_quantity, vehicle_number, driver_phone, source_type,
                    warehouse_id, remarks, notification_status, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)
            `).run(
                dispatchNumber,
                newLoadingId,
                po_id,
                date,
                loadQty,
                vehicle_number.toUpperCase().trim(),
                driver_phone || null,
                fulfillment_type,
                fulfillment_type === 'Warehouse' ? warehouse_id : null,
                remarks || '',
                req.user?.fullName || 'Staff'
            );
            newDispatchId = dspRes.lastInsertRowid;

            // Update sub-order loaded quantity and status
            if (subOrder) {
                const newSubLoaded = Number(subOrder.loaded_quantity || 0) + loadQty;
                const newSubStatus = newSubLoaded >= Number(subOrder.ordered_quantity) ? 'Loaded' : 'Partially Loaded';
                db.prepare('UPDATE po_sub_orders SET loaded_quantity = ?, status = ? WHERE id = ?').run(newSubLoaded, newSubStatus, subOrder.id);

                // Update sub_orders_json on purchase_orders
                const currentPO = db.prepare('SELECT sub_orders_json FROM purchase_orders WHERE id = ?').get(po_id);
                if (currentPO?.sub_orders_json) {
                    try {
                        const subs = JSON.parse(currentPO.sub_orders_json);
                        for (const s of subs) {
                            if ((s.subOrderNo && s.subOrderNo === subOrder.sub_order_no) || (s.sub_order_no && s.sub_order_no === subOrder.sub_order_no)) {
                                s.loaded_quantity = newSubLoaded;
                                s.loadedQuantity = newSubLoaded;
                                s.status = newSubStatus;
                            }
                        }
                        db.prepare('UPDATE purchase_orders SET sub_orders_json = ? WHERE id = ?').run(JSON.stringify(subs), po_id);
                    } catch (_) {}
                }
            }

            // Scenario 1: Industry sends rice to supplier's warehouse
            if (fulfillment_type === 'Warehouse') {
                const ind = db.prepare('SELECT name FROM industries WHERE id = ?').get(industry_id);
                const wh = db.prepare('SELECT name FROM warehouses WHERE id = ?').get(warehouse_id);

                recordInward({
                    date,
                    productId: prodId,
                    warehouseId: warehouse_id,
                    transactionType: 'Purchase Inward',
                    referenceNumber: loadingNumber,
                    source: ind?.name || 'Rice Mill',
                    destination: wh?.name || 'Warehouse',
                    quantity: loadQty,
                    rate,
                    remarks: `Inwarded from Loading ${loadingNumber} (Vehicle: ${vehicle_number}) for PO ${po.po_number}`
                }, db);
            }
            // Scenario 2: Direct dispatch from mill to customer -> does NOT increase warehouse stock

            // Update allocation status if allocation_id present
            if (allocation_id) {
                const allocRow = db.prepare('SELECT allocated_quantity FROM industry_allocations WHERE id = ?').get(allocation_id);
                const loadedSumRow = db.prepare("SELECT COALESCE(SUM(loading_quantity), 0) as total FROM loading_entries WHERE allocation_id = ? AND loading_status != 'Cancelled'").get(allocation_id);
                const loadedSum = Number(loadedSumRow?.total || 0);
                const allocStatus = loadedSum >= allocRow.allocated_quantity ? 'Loaded' : 'Partially Loaded';
                db.prepare('UPDATE industry_allocations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(allocStatus, allocation_id);
            }

            // Update derived PO status
            const newStatus = derivePOStatus(po_id);
            db.prepare('UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, po_id);

            // Record in PO Ledger
            db.prepare(`
                INSERT INTO po_ledger (po_id, po_number, event_type, title, description, actor, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                po.id,
                po.po_number,
                'LOADING_ENTRY',
                `Loading Recorded (${loadingNumber})`,
                `Vehicle ${vehicle_number.toUpperCase().trim()} loaded with ${loadQty} QTL. Location: ${loading_location || 'Mill'}.`,
                req.user?.fullName || 'Supplier Staff',
                JSON.stringify({ loadingId: newLoadingId, vehicleNumber: vehicle_number, quantity: loadQty })
            );
        });

        // Push reverse update to Orders Webapp (App A)
        if (po.original_order_id) {
            pushReverseUpdateToOrdersPortal({
                orderId: po.original_order_id,
                poNumber: po.po_number,
                eventType: 'LOADING_ADDED',
                eventPayload: {
                    loadingId: `load_${newLoadingId}`,
                    poNumber: po.po_number,
                    loadingDate: date,
                    loadingLocation: loading_location || '',
                    product: prodId,
                    plannedQuantity: orderQty,
                    actualLoadedQuantity: loadQty,
                    remainingQuantity: Math.max(0, orderQty - (currentlyLoaded + loadQty)),
                    vehicleNumber: vehicle_number.toUpperCase().trim(),
                    driverPhone: driver_phone,
                    loadingStatus: 'Loaded',
                    remarks
                },
                actor: req.user?.fullName || 'Supplier Staff'
            }).catch(() => {});
        }

        if (newDispatchId) {
            sendDispatchNotification(newDispatchId).catch(() => {});
        }

        logAction('LoadingEntry', newLoadingId, 'CREATE', req.user?.username || 'Staff', { loadingNumber, loadQty, vehicle_number, fulfillment_type });

        res.status(201).json({
            id: newLoadingId,
            loadingNumber,
            message: 'Loading entry recorded successfully'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Loading Entry (Inline cell edits)
router.put('/:id', (req, res) => {
    try {
        const {
            vehicle_number,
            driver_phone,
            loading_location,
            remarks,
            loading_status
        } = req.body;

        run(`
            UPDATE loading_entries
            SET vehicle_number = COALESCE(?, vehicle_number),
                driver_phone = COALESCE(?, driver_phone),
                loading_location = COALESCE(?, loading_location),
                remarks = COALESCE(?, remarks),
                loading_status = COALESCE(?, loading_status),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [vehicle_number ? vehicle_number.toUpperCase().trim() : null, driver_phone, loading_location, remarks, loading_status, req.params.id]);

        logAction('LoadingEntry', req.params.id, 'UPDATE_CELL', req.user?.username || 'Staff', req.body);
        res.json({ message: 'Loading entry updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Bulk Batch Save / Multi-row Paste from Excel
router.post('/bulk-save', (req, res) => {
    try {
        const { rows } = req.body;
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ error: 'Array of rows required for bulk save' });
        }

        const results = [];

        transaction((db) => {
            for (const r of rows) {
                if (r.id) {
                    // Update existing row
                    db.prepare(`
                        UPDATE loading_entries
                        SET vehicle_number = COALESCE(?, vehicle_number),
                            loading_location = COALESCE(?, loading_location),
                            remarks = COALESCE(?, remarks),
                            loading_status = COALESCE(?, loading_status),
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).run(
                        r.vehicle_number ? r.vehicle_number.toUpperCase().trim() : null,
                        r.loading_location,
                        r.remarks,
                        r.loading_status,
                        r.id
                    );
                    results.push({ id: r.id, status: 'UPDATED' });
                }
            }
        });

        logAction('LoadingEntry', 'BULK', 'BULK_UPDATE', req.user?.username || 'Staff', { count: rows.length });
        res.json({ success: true, count: rows.length, results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Loading Entry (with automatic reversal of dispatches and inventory)
router.delete('/:id', (req, res) => {
    try {
        const loading = get('SELECT * FROM loading_entries WHERE id = ?', [req.params.id]);
        if (!loading) return res.status(404).json({ error: 'Loading entry not found' });

        transaction((db) => {
            // Delete associated dispatch records
            db.prepare('DELETE FROM dispatches WHERE loading_id = ?').run(loading.id);

            // If warehouse fulfillment, reverse inward stock ledger entry
            if (loading.fulfillment_type === 'Warehouse') {
                const lastRow = db.prepare(`SELECT running_balance FROM stock_ledger WHERE product_id = ? ORDER BY id DESC LIMIT 1`).get(loading.product_id);
                const prev = lastRow ? lastRow.running_balance : 0;
                const newBalance = prev - loading.loading_quantity;

                db.prepare(`
                    INSERT INTO stock_ledger (
                        transaction_number, date, product_id, warehouse_id,
                        transaction_type, reference_number, source, destination,
                        inward_quantity, outward_quantity, rate, amount,
                        running_balance, remarks
                    ) VALUES (?, CURRENT_DATE, ?, ?, 'Internal Stock Issue', ?, 'Stock Reversal', 'Cancelled Loading', 0, ?, ?, ?, ?, ?)
                `).run(
                    `REV-${loading.loading_number}`,
                    loading.product_id,
                    loading.warehouse_id,
                    loading.loading_number,
                    loading.loading_quantity,
                    loading.purchase_rate,
                    loading.loading_amount,
                    newBalance,
                    `Reversal for deleted loading entry ${loading.loading_number}`
                );
            }

            db.prepare('DELETE FROM loading_entries WHERE id = ?').run(loading.id);

            // Revert sub-order loaded quantity if this loading was tied to a sub-order
            if (loading.sub_order_id || loading.sub_order_no) {
                const subToRevert = db.prepare('SELECT * FROM po_sub_orders WHERE id = ? OR (po_id = ? AND sub_order_no = ?)').get(loading.sub_order_id || 0, loading.po_id, loading.sub_order_no || '');
                if (subToRevert) {
                    const revertedQty = Math.max(0, Number(subToRevert.loaded_quantity || 0) - Number(loading.loading_quantity));
                    const revertedStatus = revertedQty >= Number(subToRevert.ordered_quantity) ? 'Loaded' : (revertedQty > 0 ? 'Partially Loaded' : 'Approved');
                    db.prepare('UPDATE po_sub_orders SET loaded_quantity = ?, status = ? WHERE id = ?').run(revertedQty, revertedStatus, subToRevert.id);

                    const poRow = db.prepare('SELECT sub_orders_json FROM purchase_orders WHERE id = ?').get(loading.po_id);
                    if (poRow?.sub_orders_json) {
                        try {
                            const subs = JSON.parse(poRow.sub_orders_json);
                            for (const s of subs) {
                                if ((s.subOrderNo && s.subOrderNo === subToRevert.sub_order_no) || (s.sub_order_no && s.sub_order_no === subToRevert.sub_order_no)) {
                                    s.loaded_quantity = revertedQty;
                                    s.loadedQuantity = revertedQty;
                                    s.status = revertedStatus;
                                }
                            }
                            db.prepare('UPDATE purchase_orders SET sub_orders_json = ? WHERE id = ?').run(JSON.stringify(subs), loading.po_id);
                        } catch (_) {}
                    }
                }
            }

            // Recalculate derived PO status
            const newStatus = derivePOStatus(loading.po_id);
            db.prepare('UPDATE purchase_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStatus, loading.po_id);
        });

        logAction('LoadingEntry', req.params.id, 'DELETE', req.user?.username || 'Staff', { loading_number: loading.loading_number });
        res.json({ message: 'Loading entry deleted successfully and inventory reconciled' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

