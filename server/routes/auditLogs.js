// server/routes/auditLogs.js
const express = require('express');
const router = express.Router();
const { getRecentLogs } = require('../services/auditService');

router.get('/', (req, res) => {
    try {
        const limit = Number(req.query.limit || 50);
        const logs = getRecentLogs(limit);
        res.json({ logs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
