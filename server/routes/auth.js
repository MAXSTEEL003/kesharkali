// server/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, get, run } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'keshar_kali_secret_key_2026';

// Middleware to authenticate token or fallback to session/header for rapid staff ops
function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // Support dev role header for seamless user switching
    const roleOverride = req.headers['x-user-role'];
    if (roleOverride) {
        req.user = {
            id: roleOverride === 'Admin' ? 1 : 2,
            username: roleOverride.toLowerCase(),
            role: roleOverride,
            fullName: roleOverride === 'Admin' ? 'Rajendra Deshmukh (Admin)' : 'Vikram Shinde (Operator)'
        };
        return next();
    }

    if (!token) {
        // Default to Admin session if not specified
        req.user = { id: 1, username: 'admin', role: 'Admin', fullName: 'Rajendra Deshmukh (Admin)' };
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}

// Login
router.post('/login', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const user = get('SELECT * FROM users WHERE username = ? AND active = 1', [username]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const valid = bcrypt.compareSync(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, fullName: user.full_name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.full_name,
                role: user.role,
                email: user.email,
                phone: user.phone
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Current user profile
router.get('/me', authMiddleware, (req, res) => {
    const user = get('SELECT id, username, full_name, role, email, phone FROM users WHERE id = ?', [req.user.id]);
    res.json({ user: user || req.user });
});

// List users
router.get('/users', authMiddleware, (req, res) => {
    const users = query('SELECT id, username, full_name, role, email, phone, active, created_at FROM users ORDER BY id ASC');
    res.json({ users });
});

module.exports = {
    router,
    authMiddleware
};
