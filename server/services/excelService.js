// server/services/excelService.js
// Genuine XLSX Generation using ExcelJS with Keshar Kali Brand Styling

const ExcelJS = require('exceljs');

const BRAND_RED = 'FF8F1717';
const BRAND_GOLD = 'FFC69A3B';
const BRAND_LIGHT_BG = 'FFFAF9F6';
const HEADER_FONT_COLOR = 'FFFFFFFF';

function applyHeaderStyle(row, fill = BRAND_RED) {
    row.font = { name: 'Calibri', size: 11, bold: true, color: { argb: HEADER_FONT_COLOR } };
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.height = 26;
    row.eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: fill }
        };
        cell.border = {
            top: { style: 'thin', color: { argb: BRAND_GOLD } },
            left: { style: 'thin', color: { argb: 'FFE0BFBB' } },
            bottom: { style: 'medium', color: { argb: BRAND_GOLD } },
            right: { style: 'thin', color: { argb: 'FFE0BFBB' } }
        };
    });
}

function applyTotalRowStyle(row) {
    row.font = { name: 'Calibri', size: 11, bold: true };
    row.height = 22;
    row.eachCell((cell) => {
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'double', color: { argb: 'FF000000' } }
        };
    });
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    } catch {
        return dateStr;
    }
}

/**
 * A. Master Loading Register Excel Export
 */
async function generateMasterLoadingExcel(rows, filters = {}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Keshar Kali Operations Portal';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Loading Register', {
        views: [{ state: 'frozen', ySplit: 2 }]
    });

    // Title Banner
    sheet.mergeCells('A1:N1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'KESHAR KALI — MASTER LOADING REGISTER (Precision in Every Grain)';
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: HEADER_FONT_COLOR } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_RED } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    // Header Columns
    sheet.getRow(2).values = [
        'Loading ID',
        'Loading Date',
        'PO Number',
        'Buyer / Customer',
        'Rice Product',
        'Industry (Mill)',
        'Fulfillment Type',
        'Vehicle Number',
        'Loading QTL',
        'Purchase Rate (₹/QTL)',
        'Loading Amount (₹)',
        'Loading Status',
        'Dispatch Status',
        'Remarks'
    ];
    applyHeaderStyle(sheet.getRow(2));

    sheet.columns = [
        { key: 'loading_number', width: 14 },
        { key: 'loading_date', width: 14, style: { alignment: { horizontal: 'center' } } },
        { key: 'po_number', width: 14 },
        { key: 'customer_name', width: 24 },
        { key: 'product_name', width: 18 },
        { key: 'industry_name', width: 28 },
        { key: 'fulfillment_type', width: 16, style: { alignment: { horizontal: 'center' } } },
        { key: 'vehicle_number', width: 16, style: { alignment: { horizontal: 'center' } } },
        { key: 'loading_quantity', width: 14, style: { numFmt: '#,##0.00', alignment: { horizontal: 'right' } } },
        { key: 'purchase_rate', width: 16, style: { numFmt: '₹#,##0.00', alignment: { horizontal: 'right' } } },
        { key: 'loading_amount', width: 18, style: { numFmt: '₹#,##0.00', alignment: { horizontal: 'right' } } },
        { key: 'loading_status', width: 14, style: { alignment: { horizontal: 'center' } } },
        { key: 'dispatch_status', width: 18, style: { alignment: { horizontal: 'center' } } },
        { key: 'remarks', width: 25 }
    ];

    let totalQtl = 0;
    let totalAmt = 0;

    rows.forEach((r, idx) => {
        const qtl = Number(r.loading_quantity) || 0;
        const amt = Number(r.loading_amount) || 0;
        totalQtl += qtl;
        totalAmt += amt;

        const row = sheet.addRow({
            loading_number: r.loading_number,
            loading_date: formatDate(r.loading_date),
            po_number: r.po_number,
            customer_name: r.customer_name,
            product_name: r.product_name,
            industry_name: r.industry_name,
            fulfillment_type: r.fulfillment_type,
            vehicle_number: r.vehicle_number,
            loading_quantity: qtl,
            purchase_rate: Number(r.purchase_rate) || 0,
            loading_amount: amt,
            loading_status: r.loading_status,
            dispatch_status: r.dispatch_status,
            remarks: r.remarks || ''
        });

        // Alternating row styling
        if (idx % 2 === 1) {
            row.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_LIGHT_BG } };
            });
        }
    });

    // Total Row
    const totalRow = sheet.addRow({
        loading_number: 'TOTAL',
        loading_date: '',
        po_number: '',
        customer_name: '',
        product_name: '',
        industry_name: '',
        fulfillment_type: '',
        vehicle_number: '',
        loading_quantity: totalQtl,
        purchase_rate: totalQtl > 0 ? totalAmt / totalQtl : 0,
        loading_amount: totalAmt,
        loading_status: '',
        dispatch_status: '',
        remarks: ''
    });
    applyTotalRowStyle(totalRow);

    sheet.autoFilter = 'A2:N2';
    return workbook.xlsx.writeBuffer();
}

/**
 * B. Industry-wise Report Excel Export
 */
async function generateIndustryWiseExcel(rows) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Keshar Kali Operations Portal';

    const sheet = workbook.addWorksheet('Industry Report', {
        views: [{ state: 'frozen', ySplit: 2 }]
    });

    sheet.mergeCells('A1:J1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'KESHAR KALI — INDUSTRY-WISE SOURCING & PROCUREMENT REPORT (CONFIDENTIAL)';
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: HEADER_FONT_COLOR } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5E1010' } }; // Deep burgundy
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    sheet.getRow(2).values = [
        'Industry (Rice Mill)',
        'Loading Date',
        'Loading ID',
        'PO Number',
        'Buyer / Customer',
        'Product',
        'Vehicle Number',
        'Loading Quantity (QTL)',
        'Purchase Rate (₹/QTL)',
        'Loading Amount (₹)'
    ];
    applyHeaderStyle(sheet.getRow(2), 'FF5E1010');

    sheet.columns = [
        { key: 'industry_name', width: 28 },
        { key: 'loading_date', width: 14, style: { alignment: { horizontal: 'center' } } },
        { key: 'loading_number', width: 14 },
        { key: 'po_number', width: 14 },
        { key: 'customer_name', width: 24 },
        { key: 'product_name', width: 18 },
        { key: 'vehicle_number', width: 16, style: { alignment: { horizontal: 'center' } } },
        { key: 'loading_quantity', width: 16, style: { numFmt: '#,##0.00', alignment: { horizontal: 'right' } } },
        { key: 'purchase_rate', width: 16, style: { numFmt: '₹#,##0.00', alignment: { horizontal: 'right' } } },
        { key: 'loading_amount', width: 18, style: { numFmt: '₹#,##0.00', alignment: { horizontal: 'right' } } }
    ];

    let grandQtl = 0;
    let grandAmt = 0;

    rows.forEach((r, idx) => {
        const qtl = Number(r.loading_quantity) || 0;
        const amt = Number(r.loading_amount) || 0;
        grandQtl += qtl;
        grandAmt += amt;

        sheet.addRow({
            industry_name: r.industry_name,
            loading_date: formatDate(r.loading_date),
            loading_number: r.loading_number,
            po_number: r.po_number,
            customer_name: r.customer_name,
            product_name: r.product_name,
            vehicle_number: r.vehicle_number,
            loading_quantity: qtl,
            purchase_rate: Number(r.purchase_rate) || 0,
            loading_amount: amt
        });
    });

    const totalRow = sheet.addRow({
        industry_name: 'GRAND TOTAL',
        loading_date: '',
        loading_number: '',
        po_number: '',
        customer_name: '',
        product_name: '',
        vehicle_number: '',
        loading_quantity: grandQtl,
        purchase_rate: grandQtl > 0 ? grandAmt / grandQtl : 0,
        loading_amount: grandAmt
    });
    applyTotalRowStyle(totalRow);

    sheet.autoFilter = 'A2:J2';
    return workbook.xlsx.writeBuffer();
}

/**
 * C. Buyer-wise Report Excel Export
 */
async function generateBuyerWiseExcel(rows) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Keshar Kali Operations Portal';

    const sheet = workbook.addWorksheet('Buyer Report', {
        views: [{ state: 'frozen', ySplit: 2 }]
    });

    sheet.mergeCells('A1:K1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'KESHAR KALI — BUYER-WISE FULFILLMENT & ORDER REPORT';
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: HEADER_FONT_COLOR } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_RED } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    sheet.getRow(2).values = [
        'Buyer / Customer',
        'PO Number',
        'PO Date',
        'Product',
        'Ordered QTL',
        'Loaded QTL',
        'Dispatched QTL',
        'Remaining QTL',
        'Selling Rate (₹/QTL)',
        'Order Value (₹)',
        'Status'
    ];
    applyHeaderStyle(sheet.getRow(2));

    sheet.columns = [
        { key: 'customer_name', width: 24 },
        { key: 'po_number', width: 14 },
        { key: 'po_date', width: 14, style: { alignment: { horizontal: 'center' } } },
        { key: 'product_name', width: 18 },
        { key: 'ordered_quantity', width: 14, style: { numFmt: '#,##0.00', alignment: { horizontal: 'right' } } },
        { key: 'loaded_quantity', width: 14, style: { numFmt: '#,##0.00', alignment: { horizontal: 'right' } } },
        { key: 'dispatched_quantity', width: 16, style: { numFmt: '#,##0.00', alignment: { horizontal: 'right' } } },
        { key: 'remaining_quantity', width: 16, style: { numFmt: '#,##0.00', alignment: { horizontal: 'right' } } },
        { key: 'customer_selling_rate', width: 16, style: { numFmt: '₹#,##0.00', alignment: { horizontal: 'right' } } },
        { key: 'order_value', width: 18, style: { numFmt: '₹#,##0.00', alignment: { horizontal: 'right' } } },
        { key: 'status', width: 16, style: { alignment: { horizontal: 'center' } } }
    ];

    let sumOrdered = 0;
    let sumLoaded = 0;
    let sumDispatched = 0;
    let sumRemaining = 0;
    let sumValue = 0;

    rows.forEach((r) => {
        const ord = Number(r.ordered_quantity) || 0;
        const ldd = Number(r.loaded_quantity) || 0;
        const dsp = Number(r.dispatched_quantity) || 0;
        const rem = Number(r.remaining_quantity) || 0;
        const val = Number(r.order_value) || (ord * (Number(r.customer_selling_rate) || 0));

        sumOrdered += ord;
        sumLoaded += ldd;
        sumDispatched += dsp;
        sumRemaining += rem;
        sumValue += val;

        sheet.addRow({
            customer_name: r.customer_name,
            po_number: r.po_number,
            po_date: formatDate(r.po_date),
            product_name: r.product_name,
            ordered_quantity: ord,
            loaded_quantity: ldd,
            dispatched_quantity: dsp,
            remaining_quantity: rem,
            customer_selling_rate: Number(r.customer_selling_rate) || 0,
            order_value: val,
            status: r.status
        });
    });

    const totalRow = sheet.addRow({
        customer_name: 'TOTAL',
        po_number: '',
        po_date: '',
        product_name: '',
        ordered_quantity: sumOrdered,
        loaded_quantity: sumLoaded,
        dispatched_quantity: sumDispatched,
        remaining_quantity: sumRemaining,
        customer_selling_rate: sumOrdered > 0 ? sumValue / sumOrdered : 0,
        order_value: sumValue,
        status: ''
    });
    applyTotalRowStyle(totalRow);

    sheet.autoFilter = 'A2:K2';
    return workbook.xlsx.writeBuffer();
}

/**
 * D. PO-wise Fulfillment Report Excel Export
 */
async function generatePOFulfillmentExcel(rows) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Keshar Kali Operations Portal';

    const sheet = workbook.addWorksheet('PO Fulfillment', {
        views: [{ state: 'frozen', ySplit: 2 }]
    });

    sheet.mergeCells('A1:J1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'KESHAR KALI — PO-WISE FULFILLMENT & SOURCING PIPELINE';
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: HEADER_FONT_COLOR } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_RED } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    sheet.getRow(2).values = [
        'PO Number',
        'Customer',
        'Product',
        'Ordered QTL',
        'Allocated QTL',
        'Loaded QTL',
        'Dispatched QTL',
        'Pending Loading',
        'Pending Dispatch',
        'Fulfillment %'
    ];
    applyHeaderStyle(sheet.getRow(2));

    sheet.columns = [
        { key: 'po_number', width: 14 },
        { key: 'customer_name', width: 24 },
        { key: 'product_name', width: 18 },
        { key: 'ordered_quantity', width: 14, style: { numFmt: '#,##0.00', alignment: { horizontal: 'right' } } },
        { key: 'allocated_quantity', width: 14, style: { numFmt: '#,##0.00', alignment: { horizontal: 'right' } } },
        { key: 'loaded_quantity', width: 14, style: { numFmt: '#,##0.00', alignment: { horizontal: 'right' } } },
        { key: 'dispatched_quantity', width: 16, style: { numFmt: '#,##0.00', alignment: { horizontal: 'right' } } },
        { key: 'pending_loading', width: 16, style: { numFmt: '#,##0.00', alignment: { horizontal: 'right' } } },
        { key: 'pending_dispatch', width: 16, style: { numFmt: '#,##0.00', alignment: { horizontal: 'right' } } },
        { key: 'fulfillment_pct', width: 16, style: { numFmt: '0.0%', alignment: { horizontal: 'right' } } }
    ];

    rows.forEach(r => {
        sheet.addRow({
            po_number: r.po_number,
            customer_name: r.customer_name,
            product_name: r.product_name,
            ordered_quantity: Number(r.ordered_quantity) || 0,
            allocated_quantity: Number(r.allocated_quantity) || 0,
            loaded_quantity: Number(r.loaded_quantity) || 0,
            dispatched_quantity: Number(r.dispatched_quantity) || 0,
            pending_loading: Number(r.pending_loading) || 0,
            pending_dispatch: Number(r.pending_dispatch) || 0,
            fulfillment_pct: (Number(r.dispatched_quantity) || 0) / (Number(r.ordered_quantity) || 1)
        });
    });

    sheet.autoFilter = 'A2:J2';
    return workbook.xlsx.writeBuffer();
}

/**
 * E. Stock Ledger & Stock Summary Excel Export
 */
async function generateStockLedgerExcel(ledgerRows, summaryRows) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Keshar Kali Operations Portal';

    // Worksheet 1: Chronological Ledger
    const wsLedger = workbook.addWorksheet('Chronological Stock Ledger', {
        views: [{ state: 'frozen', ySplit: 2 }]
    });

    wsLedger.mergeCells('A1:K1');
    const titleCell = wsLedger.getCell('A1');
    titleCell.value = 'KESHAR KALI — AUDITED STOCK LEDGER (RUNNING BALANCE)';
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: HEADER_FONT_COLOR } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_RED } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    wsLedger.getRow(1).height = 30;

    wsLedger.getRow(2).values = [
        'Date',
        'Transaction ID',
        'Product',
        'Transaction Type',
        'Ref Document',
        'Source',
        'Destination',
        'Inward QTL',
        'Outward QTL',
        'Running Balance QTL',
        'Remarks'
    ];
    applyHeaderStyle(wsLedger.getRow(2));

    wsLedger.columns = [
        { key: 'date', width: 14, style: { alignment: { horizontal: 'center' } } },
        { key: 'transaction_number', width: 16 },
        { key: 'product_name', width: 18 },
        { key: 'transaction_type', width: 20 },
        { key: 'reference_number', width: 16 },
        { key: 'source', width: 24 },
        { key: 'destination', width: 24 },
        { key: 'inward_quantity', width: 14, style: { numFmt: '#,##0.00', alignment: { horizontal: 'right' } } },
        { key: 'outward_quantity', width: 14, style: { numFmt: '#,##0.00', alignment: { horizontal: 'right' } } },
        { key: 'running_balance', width: 20, style: { numFmt: '#,##0.00', font: { bold: true }, alignment: { horizontal: 'right' } } },
        { key: 'remarks', width: 28 }
    ];

    ledgerRows.forEach((r, idx) => {
        const row = wsLedger.addRow({
            date: formatDate(r.date),
            transaction_number: r.transaction_number,
            product_name: r.product_name,
            transaction_type: r.transaction_type,
            reference_number: r.reference_number || '',
            source: r.source || '',
            destination: r.destination || '',
            inward_quantity: Number(r.inward_quantity) || 0,
            outward_quantity: Number(r.outward_quantity) || 0,
            running_balance: Number(r.running_balance) || 0,
            remarks: r.remarks || ''
        });

        if (idx % 2 === 1) {
            row.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_LIGHT_BG } };
            });
        }
    });

    wsLedger.autoFilter = 'A2:K2';

    // Worksheet 2: Stock Summary
    const wsSummary = workbook.addWorksheet('Stock Summary', {
        views: [{ state: 'frozen', ySplit: 2 }]
    });

    wsSummary.mergeCells('A1:H1');
    const sTitle = wsSummary.getCell('A1');
    sTitle.value = 'KESHAR KALI — INVENTORY POSITION & RESERVATION SUMMARY';
    sTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: HEADER_FONT_COLOR } };
    sTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5E1010' } };
    sTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    wsSummary.getRow(1).height = 30;

    wsSummary.getRow(2).values = [
        'Product Code',
        'Product Name',
        'Brand Tier',
        'Unit',
        'Physical Balance (QTL)',
        'Reserved Stock (QTL)',
        'Available Stock (QTL)',
        'Status'
    ];
    applyHeaderStyle(wsSummary.getRow(2), 'FF5E1010');

    wsSummary.columns = [
        { key: 'code', width: 14 },
        { key: 'name', width: 20 },
        { key: 'brand', width: 20 },
        { key: 'unit', width: 10, style: { alignment: { horizontal: 'center' } } },
        { key: 'physicalBalance', width: 22, style: { numFmt: '#,##0.00', font: { bold: true }, alignment: { horizontal: 'right' } } },
        { key: 'reservedQuantity', width: 22, style: { numFmt: '#,##0.00', alignment: { horizontal: 'right' } } },
        { key: 'availableQuantity', width: 22, style: { numFmt: '#,##0.00', font: { bold: true }, alignment: { horizontal: 'right' } } },
        { key: 'status', width: 16, style: { alignment: { horizontal: 'center' } } }
    ];

    summaryRows.forEach(r => {
        wsSummary.addRow({
            code: r.productCode,
            name: r.productName,
            brand: r.brand,
            unit: r.unit,
            physicalBalance: Number(r.physicalBalance) || 0,
            reservedQuantity: Number(r.reservedQuantity) || 0,
            availableQuantity: Number(r.availableQuantity) || 0,
            status: r.isLowStock ? 'LOW STOCK' : 'NORMAL'
        });
    });

    wsSummary.autoFilter = 'A2:H2';

    return workbook.xlsx.writeBuffer();
}

module.exports = {
    generateMasterLoadingExcel,
    generateIndustryWiseExcel,
    generateBuyerWiseExcel,
    generatePOFulfillmentExcel,
    generateStockLedgerExcel
};

