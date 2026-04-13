const mongoose = require('mongoose');

/**
 * Audit Log Model
 * Synchronizes with Supabase audit_logs table
 * Tracks all parental actions for accountability and monitoring
 */
const auditLogSchema = new mongoose.Schema({
  // Sync with Supabase UUID
  supabaseId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  
  // Parent who performed the action
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parent',
    required: true,
    index: true
  },
  
  supabaseParentId: {
    type: String,
    required: true,
    index: true
  },
  
  // Child/user affected by the action (optional)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  
  supabaseUserId: {
    type: String,
    default: null
  },
  
  // Action type
  action: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
    index: true
  },
  
  // Action category for grouping
  category: {
    type: String,
    enum: ['merit', 'storage', 'payment', 'profile', 'security', 'system', 'other'],
    default: 'other',
    index: true
  },
  
  // Detailed action data
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // IP address and user agent for security tracking
  ipAddress: {
    type: String,
    default: null
  },
  
  userAgent: {
    type: String,
    default: null
  },
  
  // Severity level
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical'],
    default: 'info'
  },
  
  // Whether this action requires review
  requiresReview: {
    type: Boolean,
    default: false
  },
  
  // Review status
  reviewStatus: {
    type: String,
    enum: ['pending', 'reviewed', 'dismissed'],
    default: 'pending'
  },
  
  reviewedAt: {
    type: Date,
    default: null
  },
  
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parent',
    default: null
  },
  
  // Sync metadata
  lastSyncedAt: {
    type: Date,
    default: Date.now
  },
  
  syncStatus: {
    type: String,
    enum: ['synced', 'pending', 'failed'],
    default: 'synced'
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
auditLogSchema.index({ supabaseParentId: 1, createdAt: -1 });
auditLogSchema.index({ category: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ severity: 1, requiresReview: 1 });
auditLogSchema.index({ createdAt: -1 }); // For time-based queries

// Pre-save middleware to categorize actions
auditLogSchema.pre('save', function(next) {
  const actionCategories = {
    merit: ['update_merit_score', 'adjust_merit', 'reset_merit', 'merit_change'],
    storage: ['enable_storage_sharing', 'disable_storage_sharing', 'create_storage_record', 'complete_storage'],
    payment: ['process_payment', 'refund_payment', 'upgrade_angel_tier', 'purchase_cosmetic'],
    profile: ['update_profile', 'change_username', 'update_age_group'],
    security: ['login', 'logout', 'password_change', 'recovery_key_used', 'account_recovery']
  };
  
  for (const [category, actions] of Object.entries(actionCategories)) {
    if (actions.some(a => this.action.toLowerCase().includes(a))) {
      this.category = category;
      break;
    }
  }
  
  // Auto-flag critical actions for review
  const criticalActions = ['account_recovery', 'password_change', 'recovery_key_used', 'delete_account'];
  if (criticalActions.some(a => this.action.toLowerCase().includes(a))) {
    this.severity = 'critical';
    this.requiresReview = true;
  }
  
  next();
});

// Static method to sync from Supabase
auditLogSchema.statics.syncFromSupabase = async function(auditData) {
  const {
    id,
    parent_id,
    user_id,
    action,
    details,
    created_at
  } = auditData;

  // Find associated MongoDB records if they exist
  const Parent = mongoose.model('Parent');
  const User = mongoose.model('User');
  
  const [parent, user] = await Promise.all([
    Parent.findOne({ supabaseId: parent_id }),
    user_id ? User.findOne({ supabaseId: user_id }) : Promise.resolve(null)
  ]);

  const updateData = {
    supabaseId: id,
    supabaseParentId: parent_id,
    parentId: parent?._id || null,
    supabaseUserId: user_id || null,
    userId: user?._id || null,
    action: action,
    details: details || {},
    lastSyncedAt: new Date(),
    syncStatus: 'synced'
  };

  if (created_at) {
    updateData.createdAt = new Date(created_at);
  }

  return this.findOneAndUpdate(
    { supabaseId: id },
    updateData,
    { upsert: true, new: true }
  );
};

// Instance method to mark as reviewed
auditLogSchema.methods.markReviewed = async function(reviewerId) {
  this.reviewStatus = 'reviewed';
  this.reviewedAt = new Date();
  this.reviewedBy = reviewerId;
  return this.save();
};

// Static method to get audit statistics for a parent
auditLogSchema.statics.getParentAuditStats = async function(supabaseParentId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const stats = await this.aggregate([
    {
      $match: {
        supabaseParentId: supabaseParentId,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        actions: { $addToSet: '$action' }
      }
    }
  ]);
  
  // Get total actions and critical actions count
  const totals = await this.aggregate([
    {
      $match: {
        supabaseParentId: supabaseParentId,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalActions: { $sum: 1 },
        criticalActions: {
          $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] }
        },
        pendingReview: {
          $sum: { 
            $cond: [
              { 
                $and: [
                  { $eq: ['$requiresReview', true] },
                  { $eq: ['$reviewStatus', 'pending'] }
                ]
              }, 
              1, 
              0
            ]
          }
        }
      }
    }
  ]);
  
  return {
    byCategory: stats.reduce((acc, item) => {
      acc[item._id] = {
        count: item.count,
        actions: item.actions
      };
      return acc;
    }, {}),
    totals: totals[0] || { totalActions: 0, criticalActions: 0, pendingReview: 0 },
    period: days
  };
};

// Static method to get recent activity for dashboard
auditLogSchema.statics.getRecentActivity = async function(supabaseParentId, limit = 10) {
  return this.find({ supabaseParentId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('action category severity details createdAt')
    .lean();
};

// Static method to search audit logs
auditLogSchema.statics.searchLogs = async function(query) {
  const {
    supabaseParentId,
    category,
    severity,
    action,
    startDate,
    endDate,
    requiresReview,
    page = 1,
    limit = 50
  } = query;
  
  const filter = {};
  
  if (supabaseParentId) filter.supabaseParentId = supabaseParentId;
  if (category) filter.category = category;
  if (severity) filter.severity = severity;
  if (action) filter.action = { $regex: action, $options: 'i' };
  if (requiresReview !== undefined) filter.requiresReview = requiresReview;
  
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }
  
  const skip = (page - 1) * limit;
  
  const [logs, total] = await Promise.all([
    this.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(filter)
  ]);
  
  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
