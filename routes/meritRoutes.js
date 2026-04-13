const express = require('express');
const router = express.Router();
const meritController = require('../controllers/meritController');
const { protectRoute } = require('../middleware/authMiddleware');

/**
 * @route   GET /api/merit/history/:userId
 * @desc    Get merit history for a user
 * @access  Private
 */
router.get('/history/:userId', protectRoute, meritController.getMeritHistory);

/**
 * @route   GET /api/merit/stats/:userId
 * @desc    Get merit stats for a user
 * @access  Private
 */
router.get('/stats/:userId', protectRoute, meritController.getMeritStats);

/**
 * @route   POST /api/merit/calculate-avatar
 * @desc    Calculate avatar state from merit score
 * @access  Private
 */
router.post('/calculate-avatar', protectRoute, meritController.calculateAvatar);

/**
 * @route   GET /api/merit/leaderboard
 * @desc    Get merit leaderboard
 * @access  Private
 */
router.get('/leaderboard', protectRoute, meritController.getLeaderboard);

/**
 * @route   POST /api/merit/update-score
 * @desc    Update merit score for a user
 * @access  Private
 */
router.post('/update-score', protectRoute, meritController.updateMeritScore);

/**
 * @route   GET /api/merit/recent
 * @desc    Get recent merit activity
 * @access  Private
 */
router.get('/recent', protectRoute, meritController.getRecentActivity);

module.exports = router;
