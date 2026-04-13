const express = require('express');
const router = express.Router();
const storageController = require('../controllers/storageController');
const { protectRoute } = require('../middleware/authMiddleware');

/**
 * @route   POST /api/storage/share
 * @desc    Create storage sharing record
 * @access  Private
 */
router.post('/share', protectRoute, storageController.createStorageRecord);

/**
 * @route   GET /api/storage/ledger/:userId
 * @desc    Get storage ledger for a user
 * @access  Private
 */
router.get('/ledger/:userId', protectRoute, storageController.getStorageLedger);

/**
 * @route   GET /api/storage/stats/:userId
 * @desc    Get storage stats for a user
 * @access  Private
 */
router.get('/stats/:userId', protectRoute, storageController.getStorageStats);

/**
 * @route   POST /api/storage/toggle
 * @desc    Toggle storage sharing for a user
 * @access  Private
 */
router.post('/toggle', protectRoute, storageController.toggleStorageSharing);

/**
 * @route   POST /api/storage/complete/:recordId
 * @desc    Complete storage record
 * @access  Private
 */
router.post('/complete/:recordId', protectRoute, storageController.completeStorageRecord);

/**
 * @route   POST /api/storage/cancel/:recordId
 * @desc    Cancel storage record
 * @access  Private
 */
router.post('/cancel/:recordId', protectRoute, storageController.cancelStorageRecord);

module.exports = router;
