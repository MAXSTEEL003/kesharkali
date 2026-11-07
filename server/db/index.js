// server/db/index.js
// Node.js 22 built-in SQLite wrapper with transaction support

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const DB_DIR = path.resolve(__dirname, '../../data');
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, 'kesharkali.db');

let dbInstance = null;

function getDb() {
    if (!dbInstance) {
        dbInstance = new DatabaseSync(DB_PATH);
        // Optimize for concurrent operational reads and high performance
        dbInstance.exec('PRAGMA foreign_keys = ON;');
        dbInstance.exec('PRAGMA journal_mode = WAL;');
        dbInstance.exec('PRAGMA synchronous = NORMAL;');
    }
    return dbInstance;
}

function initDb() {
    const db = getDb();
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);
    return db;
}

// Helper methods with clean parameter handling
function query(sql, params = []) {
    const db = getDb();
    const stmt = db.prepare(sql);
    return stmt.all(...params);
}

function get(sql, params = []) {
    const db = getDb();
    const stmt = db.prepare(sql);
    return stmt.get(...params);
}

function run(sql, params = []) {
    const db = getDb();
    const stmt = db.prepare(sql);
    return stmt.run(...params);
}

// Transaction wrapper with automatic rollback on error
function transaction(fn) {
    const db = getDb();
    db.exec('BEGIN IMMEDIATE TRANSACTION;');
    try {
        const result = fn(db);
        db.exec('COMMIT;');
        return result;
    } catch (err) {
        try {
            db.exec('ROLLBACK;');
        } catch (rollbackErr) {
            console.error('Rollback error:', rollbackErr);
        }
        throw err;
    }
}

module.exports = {
    getDb,
    initDb,
    query,
    get,
    run,
    transaction,
    DB_PATH
};
