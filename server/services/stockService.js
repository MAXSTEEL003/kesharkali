// server/services/stockService.js
// Authoritative Stock Ledger & Inventory Accounting Engine

const { query, get, run, transaction } = require('../db');

function formatNumber(num) {
    return Number((Number(num) || 0).toFixed(2));
}

function getNextTxnNumber() {
    const year = new Date().getFullYear();
    const last = get(`
        SELECT transaction_number FROM stock_ledger 
        WHERE transaction_number LIKE ? 
        ORDER BY id DESC LIMIT 1
    `, [`TXN-${year}-%`]);

    if (!last || !last.transaction_number) {
        return `TXN-${year}-0001`;
    }
    const parts = last.transaction_number.split('-');
    const seq = parseInt(parts[2], 10) + 1;
    return `TXN-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Get current physical stock for a product across all warehouses, or for a specific warehouse
 */
function getPhysicalStock(productId, warehouseId = null) {
    if (warehouseId) {
        const row = get(`
            SELECT COALESCE(SUM(inward_quantity - outward_quantity), 0) as physical_stock
            FROM stock_ledger
            WHERE product_id = ? AND warehouse_id = ?
        `, [productId, warehouseId]);
        return formatNumber(row?.physical_stock || 0);
    }
    const row = get(`
        SELECT COALESCE(SUM(inward_quantity - outward_quantity), 0) as physical_stock
        FROM stock_ledger
        WHERE product_id = ?
    `, [productId]);
    return formatNumber(row?.physical_stock || 0);
}

/**
 * Get active reserved stock for a product (Decommissioned: always 0)
 */
function getReservedStock(productId, warehouseId = null) {
    return 0;
}

/**
 * Calculate Available Stock = Physical Stock (Direct 1:1 inventory accounting)
 */
function getAvailableStock(productId, warehouseId = null) {
    return getPhysicalStock(productId, warehouseId);
}

/**
 * Core atomic ledger entry creation
 * Preserves chronological sequence and strict running balance per product
 */
function recordLedgerTransaction(data, externalDb = null) {
    const {
        date,
        productId,
        warehouseId = null,
        transactionType,
        referenceNumber = null,
        source = null,
        destination = null,
        inwardQuantity = 0,
        outwardQuantity = 0,
        rate = 0,
        remarks = null
    } = data;

    const execute = (db) => {
        // Find previous running balance for this product
        const lastRow = db.prepare(`
            SELECT running_balance FROM stock_ledger 
            WHERE product_id = ? 
            ORDER BY id DESC LIMIT 1
        `).get(productId);

        const prevBalance = lastRow ? lastRow.running_balance : 0;
        const newBalance = formatNumber(prevBalance + inwardQuantity - outwardQuantity);

        if (newBalance < 0 && outwardQuantity > 0) {
            throw new Error(`Insufficient physical stock for product ID ${productId}. Current balance: ${prevBalance} QTL, Attempted outward: ${outwardQuantity} QTL.`);
        }

        const txnNumber = getNextTxnNumber();
        const amount = formatNumber((inwardQuantity > 0 ? inwardQuantity : outwardQuantity) * rate);

        const stmt = db.prepare(`
            INSERT INTO stock_ledger (
                transaction_number, date, product_id, warehouse_id,
                transaction_type, reference_number, source, destination,
                inward_quantity, outward_quantity, rate, amount,
                running_balance, remarks
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            txnNumber,
            date,
            productId,
            warehouseId,
            transactionType,
            referenceNumber,
            source,
            destination,
            inwardQuantity,
            outwardQuantity,
            rate,
            amount,
            newBalance,
            remarks
        );

        return {
            transactionNumber: txnNumber,
            runningBalance: newBalance,
            productId,
            inwardQuantity,
            outwardQuantity
        };
    };

    if (externalDb) {
        return execute(externalDb);
    }
    return transaction(execute);
}

/**
 * Record Stock Inward (Purchases from Mills, Returns, Inward Replenishments)
 */
function recordInward(data, externalDb = null) {
    return recordLedgerTransaction({
        date: data.date,
        productId: data.productId,
        warehouseId: data.warehouseId,
        transactionType: data.transactionType || 'Purchase Inward',
        referenceNumber: data.referenceNumber,
        source: data.source,
        destination: data.destination || 'Supplier Godown',
        inwardQuantity: Number(data.quantity),
        outwardQuantity: 0,
        rate: Number(data.rate || 0),
        remarks: data.remarks
    }, externalDb);
}

/**
 * Record Stock Outward (Customer Dispatches from Warehouse, Issues)
 */
function recordOutward(data, externalDb = null) {
    return recordLedgerTransaction({
        date: data.date,
        productId: data.productId,
        warehouseId: data.warehouseId,
        transactionType: data.transactionType || 'Customer Dispatch',
        referenceNumber: data.referenceNumber,
        source: data.source || 'Supplier Godown',
        destination: data.destination,
        inwardQuantity: 0,
        outwardQuantity: Number(data.quantity),
        rate: Number(data.rate || 0),
        remarks: data.remarks
    }, externalDb);
}

/**
 * Reserve stock for a PO (Decommissioned: no-op safe stub)
 */
function reserveStock(poId, productId, warehouseId, quantity, externalDb = null) {
    return { reservationId: null, poId, productId, reservedQuantity: 0 };
}

/**
 * Release / Consume reservation when dispatched (Decommissioned: no-op safe stub)
 */
function releaseReservation(poId, productId, quantity, externalDb = null) {
    return { released: 0 };
}

/**
 * Inter-godown transfer: Creates Outward from source and Inward to destination connected by single transfer reference
 */
function transferStock(data) {
    return transaction((db) => {
        const { date, productId, sourceWarehouseId, destWarehouseId, quantity, vehicleNumber, remarks, createdBy } = data;

        if (sourceWarehouseId === destWarehouseId) {
            throw new Error('Source and destination warehouse cannot be identical.');
        }

        // Validate source warehouse stock
        const sourceStock = getPhysicalStock(productId, sourceWarehouseId);
        if (sourceStock < quantity) {
            throw new Error(`Insufficient stock in source warehouse. Available: ${sourceStock} QTL, Required: ${quantity} QTL.`);
        }

        const year = new Date().getFullYear();
        const lastTrf = db.prepare(`
            SELECT transfer_number FROM stock_transfers 
            WHERE transfer_number LIKE ? 
            ORDER BY id DESC LIMIT 1
        `).get(`TRF-${year}-%`);

        let seq = 1;
        if (lastTrf && lastTrf.transfer_number) {
            seq = parseInt(lastTrf.transfer_number.split('-')[2], 10) + 1;
        }
        const transferNumber = `TRF-${year}-${String(seq).padStart(4, '0')}`;

        db.prepare(`
            INSERT INTO stock_transfers (transfer_number, date, product_id, source_warehouse_id, dest_warehouse_id, quantity, vehicle_number, remarks, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(transferNumber, date, productId, sourceWarehouseId, destWarehouseId, quantity, vehicleNumber || '', remarks || '', createdBy || 'Staff');

        const sourceWh = db.prepare('SELECT name FROM warehouses WHERE id = ?').get(sourceWarehouseId);
        const destWh = db.prepare('SELECT name FROM warehouses WHERE id = ?').get(destWarehouseId);

        // 1. Outward from source
        recordLedgerTransaction({
            date,
            productId,
            warehouseId: sourceWarehouseId,
            transactionType: 'Stock Transfer Out',
            referenceNumber: transferNumber,
            source: sourceWh?.name || 'Source Godown',
            destination: destWh?.name || 'Dest Godown',
            inwardQuantity: 0,
            outwardQuantity: quantity,
            rate: 0,
            remarks: `Transfer to ${destWh?.name}. Vehicle: ${vehicleNumber || 'N/A'}`
        }, db);

        // 2. Inward to destination
        recordLedgerTransaction({
            date,
            productId,
            warehouseId: destWarehouseId,
            transactionType: 'Stock Transfer In',
            referenceNumber: transferNumber,
            source: sourceWh?.name || 'Source Godown',
            destination: destWh?.name || 'Dest Godown',
            inwardQuantity: quantity,
            outwardQuantity: 0,
            rate: 0,
            remarks: `Transfer from ${sourceWh?.name}. Vehicle: ${vehicleNumber || 'N/A'}`
        }, db);

        return { transferNumber, quantity, source: sourceWh?.name, destination: destWh?.name };
    });
}

/**
 * Stock adjustments: Never overwrites history; records adjustment ledger transactions
 */
function adjustStock(data) {
    return transaction((db) => {
        const { date, productId, warehouseId, physicalStock, reason, authorizedBy } = data;

        const currentSystemStock = getPhysicalStock(productId, warehouseId);
        const difference = formatNumber(Number(physicalStock) - currentSystemStock);

        if (difference === 0) {
            return { message: 'Physical stock matches system stock. No adjustment required.', difference: 0 };
        }

        const year = new Date().getFullYear();
        const lastAdj = db.prepare(`
            SELECT adjustment_number FROM stock_adjustments 
            WHERE adjustment_number LIKE ? 
            ORDER BY id DESC LIMIT 1
        `).get(`ADJ-${year}-%`);

        let seq = 1;
        if (lastAdj && lastAdj.adjustment_number) {
            seq = parseInt(lastAdj.adjustment_number.split('-')[2], 10) + 1;
        }
        const adjNumber = `ADJ-${year}-${String(seq).padStart(4, '0')}`;

        db.prepare(`
            INSERT INTO stock_adjustments (adjustment_number, date, product_id, warehouse_id, system_stock, physical_stock, difference, reason, authorized_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(adjNumber, date, productId, warehouseId, currentSystemStock, Number(physicalStock), difference, reason, authorizedBy);

        const wh = db.prepare('SELECT name FROM warehouses WHERE id = ?').get(warehouseId);

        if (difference > 0) {
            // Surplus found
            recordLedgerTransaction({
                date,
                productId,
                warehouseId,
                transactionType: 'Stock Adjustment In',
                referenceNumber: adjNumber,
                source: 'Physical Audit Gain',
                destination: wh?.name || 'Warehouse',
                inwardQuantity: difference,
                outwardQuantity: 0,
                rate: 0,
                remarks: `Stock Audit adjustment: ${reason}. Authorized by: ${authorizedBy}`
            }, db);
        } else {
            // Deficit found
            recordLedgerTransaction({
                date,
                productId,
                warehouseId,
                transactionType: 'Stock Adjustment Out',
                referenceNumber: adjNumber,
                source: wh?.name || 'Warehouse',
                destination: 'Physical Audit Loss/Shrinkage',
                inwardQuantity: 0,
                outwardQuantity: Math.abs(difference),
                rate: 0,
                remarks: `Stock Audit deficit: ${reason}. Authorized by: ${authorizedBy}`
            }, db);
        }

        return { adjustmentNumber: adjNumber, systemStock: currentSystemStock, physicalStock, difference };
    });
}

/**
 * Stock valuation using weighted average cost (WAC)
 */
function getStockValuation() {
    const products = query('SELECT * FROM products WHERE active = 1');
    const result = [];
    let grandTotalValue = 0;
    let grandTotalStock = 0;

    for (const prod of products) {
        const physical = getPhysicalStock(prod.id);
        const reserved = 0;
        const available = physical;

        // Calculate weighted average purchase rate from inward purchase transactions
        const inwardStats = get(`
            SELECT 
                COALESCE(SUM(inward_quantity), 0) as total_inward_qty,
                COALESCE(SUM(amount), 0) as total_inward_amount
            FROM stock_ledger
            WHERE product_id = ? AND inward_quantity > 0 AND rate > 0
        `, [prod.id]);

        let avgRate = prod.standard_selling_rate * 0.88; // fallback reasonable cost
        if (inwardStats && inwardStats.total_inward_qty > 0) {
            avgRate = formatNumber(inwardStats.total_inward_amount / inwardStats.total_inward_qty);
        }

        const totalValue = formatNumber(physical * avgRate);
        grandTotalValue += totalValue;
        grandTotalStock += physical;

        result.push({
            productId: prod.id,
            productCode: prod.code,
            productName: prod.name,
            brand: prod.brand,
            variety: prod.variety,
            unit: prod.unit,
            physicalStock: physical,
            reservedStock: reserved,
            availableStock: available,
            avgPurchaseRate: avgRate,
            totalStockValue: totalValue,
            minStockThreshold: prod.min_stock_threshold,
            isLowStock: physical <= prod.min_stock_threshold
        });
    }

    return {
        products: result,
        grandTotalStock: formatNumber(grandTotalStock),
        grandTotalValue: formatNumber(grandTotalValue)
    };
}

/**
 * Complete Stock Summary by product & warehouse
 */
function getStockSummary() {
    const products = query('SELECT * FROM products WHERE active = 1 ORDER BY name ASC');
    const summary = products.map(prod => {
        const physical = getPhysicalStock(prod.id);
        const reserved = 0;
        const available = physical;

        const opening = get(`
            SELECT COALESCE(SUM(inward_quantity), 0) as opening
            FROM stock_ledger
            WHERE product_id = ? AND transaction_type = 'Opening Stock'
        `, [prod.id])?.opening || 0;

        const totalInward = get(`
            SELECT COALESCE(SUM(inward_quantity), 0) as total
            FROM stock_ledger
            WHERE product_id = ?
        `, [prod.id])?.total || 0;

        const totalOutward = get(`
            SELECT COALESCE(SUM(outward_quantity), 0) as total
            FROM stock_ledger
            WHERE product_id = ?
        `, [prod.id])?.total || 0;

        return {
            productId: prod.id,
            productCode: prod.code,
            productName: prod.name,
            brand: prod.brand,
            variety: prod.variety,
            unit: prod.unit,
            openingStock: formatNumber(opening),
            totalInward: formatNumber(totalInward),
            totalOutward: formatNumber(totalOutward),
            physicalBalance: physical,
            reservedQuantity: reserved,
            availableQuantity: available,
            minThreshold: prod.min_stock_threshold,
            isLowStock: physical <= prod.min_stock_threshold
        };
    });

    return summary;
}

module.exports = {
    getPhysicalStock,
    getReservedStock,
    getAvailableStock,
    recordLedgerTransaction,
    recordInward,
    recordOutward,
    reserveStock,
    releaseReservation,
    transferStock,
    adjustStock,
    getStockValuation,
    getStockSummary
};

