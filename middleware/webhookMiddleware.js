const crypto = require('crypto');

/**
 * Webhook Middleware
 * Verifies Supabase webhook signatures and validates payloads
 */

/**
 * Verify Supabase webhook signature
 * Supabase sends a signature in the x-supabase-signature header
 */
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-supabase-signature'] || req.headers['x-webhook-signature'];
  const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;
  
  // If no secret is configured, skip verification in development
  if (!webhookSecret && process.env.NODE_ENV === 'development') {
    console.warn('⚠️  Webhook verification skipped - SUPABASE_WEBHOOK_SECRET not set');
    return next();
  }
  
  if (!webhookSecret) {
    return res.status(401).json({
      status: 'error',
      message: 'Webhook secret not configured'
    });
  }
  
  if (!signature) {
    return res.status(401).json({
      status: 'error',
      message: 'Missing webhook signature'
    });
  }
  
  try {
    // Calculate expected signature
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');
    
    // Compare signatures using timing-safe comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
    
    if (!isValid) {
      console.error('❌ Invalid webhook signature');
      return res.status(401).json({
        status: 'error',
        message: 'Invalid webhook signature'
      });
    }
    
    next();
  } catch (error) {
    console.error('❌ Webhook signature verification error:', error);
    return res.status(401).json({
      status: 'error',
      message: 'Webhook verification failed'
    });
  }
};

/**
 * Validate webhook payload structure
 * Ensures required fields are present
 */
const validateWebhookPayload = (req, res, next) => {
  const { type, table, record, old_record } = req.body;
  
  // Check required fields
  if (!type || !table) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing required fields: type and table'
    });
  }
  
  // Validate event type
  const validTypes = ['INSERT', 'UPDATE', 'DELETE'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({
      status: 'error',
      message: `Invalid event type: ${type}. Must be one of: ${validTypes.join(', ')}`
    });
  }
  
  // Validate record presence for INSERT and UPDATE
  if ((type === 'INSERT' || type === 'UPDATE') && !record) {
    return res.status(400).json({
      status: 'error',
      message: `Missing record for ${type} event`
    });
  }
  
  // Validate old_record presence for UPDATE and DELETE
  if ((type === 'UPDATE' || type === 'DELETE') && !old_record) {
    return res.status(400).json({
      status: 'error',
      message: `Missing old_record for ${type} event`
    });
  }
  
  // Validate table name
  const validTables = [
    'user_profiles',
    'parent_accounts',
    'merit_logs',
    'storage_ledger',
    'payments',
    'audit_logs',
    'invite_codes',
    'recovery_keys'
  ];
  
  if (!validTables.includes(table)) {
    return res.status(400).json({
      status: 'error',
      message: `Unknown table: ${table}. Valid tables: ${validTables.join(', ')}`
    });
  }
  
  // Add parsed data to request for controllers
  req.webhook = {
    type,
    table,
    record,
    old_record,
    timestamp: new Date().toISOString()
  };
  
  next();
};

/**
 * Rate limiter for webhooks
 * Prevents webhook flooding
 */
const webhookRateLimit = (() => {
  const requests = new Map();
  const WINDOW_MS = 60 * 1000; // 1 minute
  const MAX_REQUESTS = 100; // Max 100 webhooks per minute
  
  return (req, res, next) => {
    const identifier = req.ip || 'unknown';
    const now = Date.now();
    
    // Clean old entries
    for (const [key, data] of requests.entries()) {
      if (now - data.timestamp > WINDOW_MS) {
        requests.delete(key);
      }
    }
    
    // Check current count
    const current = requests.get(identifier);
    if (current && current.count >= MAX_REQUESTS) {
      return res.status(429).json({
        status: 'error',
        message: 'Webhook rate limit exceeded'
      });
    }
    
    // Update count
    if (current) {
      current.count++;
    } else {
      requests.set(identifier, { count: 1, timestamp: now });
    }
    
    next();
  };
})();

/**
 * Log webhook for debugging
 */
const logWebhook = (req, res, next) => {
  const { type, table } = req.body;
  
  console.log(`
📨 Webhook Received
   Type: ${type}
   Table: ${table}
   Time: ${new Date().toISOString()}
   IP: ${req.ip}
  `);
  
  next();
};

/**
 * Error handler for webhooks
 * Returns appropriate response without exposing internal errors
 */
const webhookErrorHandler = (err, req, res, next) => {
  console.error('❌ Webhook Error:', err);
  
  // Always return 200 to prevent Supabase from retrying
  // Log the error internally but acknowledge receipt
  res.status(200).json({
    status: 'received',
    message: 'Webhook received with processing errors',
    errorId: req.webhookErrorId || 'unknown'
  });
};

module.exports = {
  verifyWebhookSignature,
  validateWebhookPayload,
  webhookRateLimit,
  logWebhook,
  webhookErrorHandler
};
