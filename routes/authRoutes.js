const express = require('express');
const router = express.Router();
// 1. Added deleteAccount to the imported functions
const { registerParent, registerChild, loginUser, deleteAccount } = require('../controllers/authController');

// --- REGISTRATION & LOGIN ---
// Registration uses the invite system and starts users as an Angel (Merit 5) [cite: 2026-01-10]
router.post('/register', registerParent);
router.post('/register-child', registerChild);

// Login verifies credentials and returns the meritScore for the avatar display [cite: 2026-01-10]
router.post('/login', loginUser);

// --- ACCOUNT SECURITY ---
// 2. NEW: Delete route strictly for account removal via 8-digit key [cite: 2026-01-10]
router.delete('/delete-account', deleteAccount);

module.exports = router;