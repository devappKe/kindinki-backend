const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { protectRoute } = require('../middleware/authMiddleware');

/**
 * @route   GET /api/payments/products
 * @desc    Get available products/pricing
 * @access  Public
 */
router.get('/products', paymentController.getProducts);

/**
 * @route   POST /api/payments/upgrade-angel
 * @desc    Process angel tier upgrade
 * @access  Private
 */
router.post('/upgrade-angel', protectRoute, paymentController.upgradeToAngelTier);

/**
 * @route   POST /api/payments/cosmetic
 * @desc    Purchase cosmetic item
 * @access  Private
 */
router.post('/cosmetic', protectRoute, paymentController.buyCosmeticItem);

/**
 * @route   GET /api/payments/history/:userId
 * @desc    Get payment history for a user
 * @access  Private
 */
router.get('/history/:userId', protectRoute, paymentController.getPaymentHistory);

/**
 * @route   GET /api/payments/summary/:userId
 * @desc    Get payment summary for a user
 * @access  Private
 */
router.get('/summary/:userId', protectRoute, paymentController.getPaymentSummary);

/**
 * @route   POST /api/payments/storage-payout
 * @desc    Record storage payout (internal use)
 * @access  Private
 */
router.post('/storage-payout', protectRoute, paymentController.recordStoragePayout);

module.exports = router;
