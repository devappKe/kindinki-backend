const express = require('express');
const router = express.Router();

// 1. Import the protectRoute middleware from its own file
// (Ensure the path matches where you saved the code you just showed me)
const { protectRoute } = require('../middleware/authMiddleware');

// 2. Import the logic that fetches the merit score
const { getUserProfile } = require('../controllers/userController');

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile to determine Angel/Devil status [cite: 2026-01-10]
 * @access  Private
 */
router.get('/profile', protectRoute, getUserProfile);

module.exports = router;