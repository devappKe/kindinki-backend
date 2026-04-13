const express = require('express');
const router = express.Router();
const { handleAccountRecovery } = require('../controllers/recoveryController');

router.post('/secure-action', handleAccountRecovery);

module.exports = router;