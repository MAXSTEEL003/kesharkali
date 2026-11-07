// server/services/auditService.js
const { run, query } = require('../db');

function logAction(entityType, entityId, action, actor, details = {}) {
    try {
        const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);
        run(`
            INSERT INTO audit_logs (entity_type, entity_id, action, actor, details)
            VALUES (?, ?, ?, ?, ?)
        `, [entityType, String(entityId), action, actor || 'System', detailsStr]);
    } catch (err) {
        console.error('Audit log failed:', err);
    }
}

function getRecentLogs(limit = 50) {
    return query(`
        SELECT * FROM audit_logs
        ORDER BY id DESC LIMIT ?
    `, [limit]);
}

module.exports = {
    logAction,
    getRecentLogs
};

