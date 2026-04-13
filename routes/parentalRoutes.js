const express = require('express');
const router = express.Router();
const parentalController = require('../controllers/parentalController');
const { protectRoute } = require('../middleware/authMiddleware');

/**
 * @route   GET /api/parental/children/:parentId
 * @desc    Get all children linked to a parent
 * @access  Private (Parent only)
 */
router.get('/children/:parentId', protectRoute, parentalController.getLinkedChildren);

/**
 * @route   GET /api/parental/child/:childId
 * @desc    Get detailed overview of a specific child
 * @access  Private (Parent only)
 */
router.get('/child/:childId', protectRoute, parentalController.getChildOverview);

/**
 * @route   POST /api/parental/log-action
 * @desc    Log a parental action
 * @access  Private (Parent only)
 */
router.post('/log-action', protectRoute, parentalController.logParentalAction);

/**
 * @route   GET /api/parental/audit-logs/:parentId
 * @desc    Get audit logs for a parent
 * @access  Private (Parent only)
 */
router.get('/audit-logs/:parentId', protectRoute, parentalController.getAuditLogs);

/**
 * @route   GET /api/parental/audit-stats/:parentId
 * @desc    Get audit statistics for a parent
 * @access  Private (Parent only)
 */
router.get('/audit-stats/:parentId', protectRoute, parentalController.getAuditStats);

/**
 * @route   POST /api/parental/review-log/:logId
 * @desc    Review an audit log entry
 * @access  Private (Parent only)
 */
router.post('/review-log/:logId', protectRoute, parentalController.reviewAuditLog);

/**
 * @route   POST /api/parental/search-logs
 * @desc    Search audit logs
 * @access  Private (Parent only)
 */
router.post('/search-logs', protectRoute, parentalController.searchAuditLogs);

module.exports = router;
