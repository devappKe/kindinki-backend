const express = require('express');
const router = express.Router();
const { handleAccountRecovery } = require('../controllers/recoveryController');

// All recovery actions (reset-password, delete) go through this secure endpoint
router.post('/reset', handleAccountRecovery);
router.post('/secure-action', handleAccountRecovery);

module.exports = router;