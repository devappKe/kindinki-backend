const express = require('express');
const router = express.Router();
const { generateInviteCode, getMyInvites } = require('../controllers/inviteController');
const { protectRoute } = require('../middleware/authMiddleware');

router.post('/generate', protectRoute, generateInviteCode);
router.get('/', protectRoute, getMyInvites);

module.exports = router;