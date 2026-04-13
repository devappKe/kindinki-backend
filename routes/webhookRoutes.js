const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const {
  verifyWebhookSignature,
  validateWebhookPayload,
  webhookRateLimit,
  logWebhook
} = require('../middleware/webhookMiddleware');

/**
 * @route   POST /api/webhooks/supabase
 * @desc    Receive webhooks from Supabase for data synchronization
 * @access  Public (secured by signature)
 */
router.post(
  '/supabase',
  webhookRateLimit,
  logWebhook,
  verifyWebhookSignature,
  validateWebhookPayload,
  webhookController.handleWebhook
);

/**
 * @route   GET /api/webhooks/status
 * @desc    Get sync status between Supabase and MongoDB
 * @access  Private (Admin only)
 */
router.get('/status', webhookController.getSyncStatus);

/**
 * @route   POST /api/webhooks/manual-sync
 * @desc    Trigger manual sync from Supabase
 * @access  Private (Admin only)
 */
router.post('/manual-sync', webhookController.manualSync);

module.exports = router;
