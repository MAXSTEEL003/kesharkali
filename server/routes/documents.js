// server/routes/documents.js
// Supplier Document & Billing Management (Invoices, Weighbridge Slips, LR copies)
const express = require('express');
const router = express.Router();
const { query, get, run } = require('../db');
const { pushReverseUpdateToOrdersPortal } = require('./integration');

// 1. GET /api/documents/po/:poId
// Get all documents linked to a PO
router.get('/po/:poId', (req, res) => {
    try {
        const { poId } = req.params;
        const isSupplier = req.user && req.user.role === 'Supplier';
        const supplierId = req.user ? req.user.supplierId : null;

        let sql = `
            SELECT d.*, p.po_number, p.original_order_id, i.name as supplier_name
            FROM supplier_documents d
            JOIN purchase_orders p ON d.po_id = p.id
            JOIN industries i ON d.supplier_id = i.id
            WHERE d.po_id = ?
        `;
        const params = [poId];

        if (isSupplier && supplierId) {
            sql += ' AND d.supplier_id = ?';
            params.push(supplierId);
        }

        sql += ' ORDER BY d.id DESC';
        const docs = query(sql, params);
        res.json({ success: true, documents: docs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. POST /api/documents/upload
// Record a supplier uploaded document (base64 data URL or external URL)
router.post('/upload', async (req, res) => {
    try {
        const { poId, loadingId, documentType, fileName, fileUrl, fileSize, mimeType } = req.body;
        if (!poId || !documentType || !fileName || !fileUrl) {
            return res.status(400).json({ error: 'Missing required document fields (poId, documentType, fileName, fileUrl)' });
        }

        const po = get('SELECT id, po_number, original_order_id, supplier_id FROM purchase_orders WHERE id = ?', [poId]);
        if (!po) {
            return res.status(404).json({ error: 'Purchase Order not found' });
        }

        // Supplier ownership check
        const isSupplier = req.user && req.user.role === 'Supplier';
        const userSupplierId = req.user ? req.user.supplierId : null;
        if (isSupplier && userSupplierId && po.supplier_id && po.supplier_id !== userSupplierId) {
            return res.status(403).json({ error: 'Access denied: You can only upload documents for your own assigned orders.' });
        }

        const supplierId = po.supplier_id || userSupplierId || 1;
        const uploadedBy = (req.user && req.user.fullName) || 'Supplier Staff';

        const result = run(`
            INSERT INTO supplier_documents (
                po_id, loading_id, supplier_id, document_type, file_name, file_url, file_size, mime_type, uploaded_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            poId,
            loadingId || null,
            supplierId,
            documentType,
            fileName,
            fileUrl,
            fileSize || 0,
            mimeType || 'application/pdf',
            uploadedBy
        ]);

        const docRecord = {
            documentId: `doc_${result.lastInsertRowid}`,
            id: result.lastInsertRowid,
            poId,
            poNumber: po.po_number,
            loadingId,
            documentType,
            fileName,
            fileUrl,
            fileSize,
            uploadedAt: new Date().toISOString(),
            uploadedBy
        };

        // Record in PO Ledger
        run(`
            INSERT INTO po_ledger (po_id, po_number, event_type, title, description, actor, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            poId,
            po.po_number,
            'DOCUMENT_UPLOADED',
            `${documentType} Uploaded`,
            `Document "${fileName}" was uploaded by ${uploadedBy}.`,
            uploadedBy,
            JSON.stringify({ documentId: result.lastInsertRowid, documentType, fileName })
        ]);

        // Push reverse update to Orders Webapp (App A)
        if (po.original_order_id) {
            pushReverseUpdateToOrdersPortal({
                orderId: po.original_order_id,
                poNumber: po.po_number,
                eventType: 'BILL_UPLOADED',
                eventPayload: docRecord,
                actor: uploadedBy
            }).catch(() => {});
        }

        res.json({
            success: true,
            message: 'Document successfully saved and synced to Orders Portal',
            document: docRecord
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. GET /api/documents and /api/documents/all (Scoped for supplier or all for Admin)
router.get('/', (req, res) => getAllDocs(req, res));
router.get('/all', (req, res) => getAllDocs(req, res));

function getAllDocs(req, res) {
    try {
        const isSupplier = req.user && req.user.role === 'Supplier';
        const supplierId = req.user ? req.user.supplierId : null;

        let sql = `
            SELECT d.*, p.po_number, p.original_order_id, i.name as supplier_name
            FROM supplier_documents d
            JOIN purchase_orders p ON d.po_id = p.id
            JOIN industries i ON d.supplier_id = i.id
        `;
        const params = [];

        if (isSupplier && supplierId) {
            sql += ' WHERE d.supplier_id = ?';
            params.push(supplierId);
        }

        sql += ' ORDER BY d.id DESC LIMIT 100';
        const docs = query(sql, params);
        res.json({ success: true, documents: docs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

module.exports = router;
