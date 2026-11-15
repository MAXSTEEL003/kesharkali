// server/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Database schema
initDb();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging in development
app.use((req, res, next) => {
    if (process.env.NODE_ENV !== 'test') {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            if (req.originalUrl.startsWith('/api')) {
                console.log(`[${req.method}] ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
            }
        });
    }
    next();
});

// Import route modules
const { router: authRouter, authMiddleware } = require('./routes/auth');
const customersRouter = require('./routes/customers');
const industriesRouter = require('./routes/industries');
const productsRouter = require('./routes/products');
const warehousesRouter = require('./routes/warehouses');
const { router: purchaseOrdersRouter } = require('./routes/purchaseOrders');
const allocationsRouter = require('./routes/allocations');
const loadingRegisterRouter = require('./routes/loadingRegister');
const dispatchesRouter = require('./routes/dispatches');
const stockRouter = require('./routes/stock');
const whatsappRouter = require('./routes/whatsapp');
const reportsRouter = require('./routes/reports');
const dashboardRouter = require('./routes/dashboard');
const auditLogsRouter = require('./routes/auditLogs');
const documentsRouter = require('./routes/documents');
const { router: integrationRouter } = require('./routes/integration');
const { isFirebaseAdminConfigured, verifyFirebaseToken } = require('./firebase/admin');

// Mount API routes
app.use(verifyFirebaseToken);
app.use('/api/integration', integrationRouter);
app.use('/api/auth', authRouter);
app.use('/api/customers', authMiddleware, customersRouter);
app.use('/api/industries', authMiddleware, industriesRouter);
app.use('/api/products', authMiddleware, productsRouter);
app.use('/api/warehouses', authMiddleware, warehousesRouter);
app.use('/api/purchase-orders', authMiddleware, purchaseOrdersRouter);
app.use('/api/allocations', authMiddleware, allocationsRouter);
app.use('/api/loading-register', authMiddleware, loadingRegisterRouter);
app.use('/api/dispatches', authMiddleware, dispatchesRouter);
app.use('/api/stock', authMiddleware, stockRouter);
app.use('/api/whatsapp', authMiddleware, whatsappRouter);
app.use('/api/reports', authMiddleware, reportsRouter);
app.use('/api/dashboard', authMiddleware, dashboardRouter);
app.use('/api/audit-logs', authMiddleware, auditLogsRouter);
app.use('/api/documents', authMiddleware, documentsRouter);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'UP',
        brand: 'Keshar Kali',
        tagline: 'Precision in Every Grain',
        systemTime: new Date().toISOString()
    });
});

// Firebase status
app.get('/api/firebase/status', (req, res) => {
    res.json({
        configured: isFirebaseAdminConfigured,
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || null,
        mode: isFirebaseAdminConfigured ? 'cloud' : 'offline-sqlite'
    });
});

// Serve uploaded documents (bills, weighbridge slips, etc.)
const fs = require('fs');
const uploadsDir = path.resolve(__dirname, '../uploads');
const billsDir = path.join(uploadsDir, 'bills');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(billsDir)) fs.mkdirSync(billsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Serve static frontend build if present
const clientDist = path.resolve(__dirname, '../dist');
app.use(express.static(clientDist));

// Catch-all for SPA client routing
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.originalUrl.startsWith('/api')) {
        const indexHtml = path.join(clientDist, 'index.html');
        return res.sendFile(indexHtml, (err) => {
            if (err) {
                res.status(200).send('Keshar Kali Operations Backend API is running.');
            }
        });
    }
    next();
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled Server Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error'
    });
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(`KESHAR KALI — OPERATIONS PORTAL BACKEND`);
        console.log(`Precision in Every Grain`);
        console.log(`Server listening on http://localhost:${PORT}`);
        console.log(`=======================================================`);

        try {
            const { startAppAListener } = require('./services/appAListener');
            startAppAListener();
        } catch (e) {
            console.warn('[App A Listener] Could not start listener on boot:', e.message);
        }
    });
}

module.exports = app;
