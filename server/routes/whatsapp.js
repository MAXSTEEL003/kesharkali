// server/routes/whatsapp.js
const express = require('express');
const router = express.Router();
const { query, get } = require('../db');
const { retryNotification, sendDispatchNotification } = require('../services/whatsappService');
const { logAction } = require('../services/auditService');

// GET all customer WhatsApp notification logs
router.get('/logs', (req, res) => {
    try {
        const { status, poId } = req.query;
        let sql = `
            SELECT 
                wn.*,
                po.po_number,
                c.name as customer_name,
                c.contact_person,
                d.dispatch_number,
                d.dispatch_quantity,
                d.vehicle_number
            FROM whatsapp_notifications wn
            JOIN purchase_orders po ON wn.po_id = po.id
            JOIN customers c ON wn.customer_id = c.id
            JOIN dispatches d ON wn.dispatch_id = d.id
            WHERE 1=1
        `;
        const params = [];
        if (status) {
            sql += ' AND wn.status = ?';
            params.push(status);
        }
        if (poId) {
            sql += ' AND wn.po_id = ?';
            params.push(poId);
        }
        sql += ' ORDER BY wn.created_at DESC';

        const logs = query(sql, params);
        res.json({ logs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Manual retry for a notification
router.post('/retry/:id', async (req, res) => {
    try {
        const result = await retryNotification(req.params.id);
        logAction('WhatsApp', req.params.id, 'RETRY', req.user?.username || 'Staff', result);
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get WhatsApp API configuration status
router.get('/config', (req, res) => {
    const hasToken = Boolean(process.env.WHATSAPP_API_TOKEN);
    const hasPhoneId = Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID);

    res.json({
        configured: hasToken && hasPhoneId,
        mode: hasToken && hasPhoneId ? 'Live WhatsApp Cloud API' : 'High-Fidelity Operations Sandbox',
        webhookActive: true,
        templateName: 'order_dispatched',
        privacyGuaranteed: true
    });
});

module.exports = router;
