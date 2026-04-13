const AuditLog = require('../models/AuditLog');
const Parent = require('../models/Parent');
const User = require('../models/User');
const MeritLog = require('../models/MeritLog');
const StorageLedger = require('../models/StorageLedger');
const Payment = require('../models/Payment');

/**
 * Parental Controller
 * Handles parent-child relationship management and monitoring
 */

/**
 * @desc    Get all children linked to a parent
 * @route   GET /api/parental/children/:parentId
 * @access  Private (Parent only)
 */
exports.getLinkedChildren = async (req, res) => {
  try {
    const { parentId } = req.params;
    
    const parent = await Parent.findOne({
      $or: [
        { _id: parentId },
        { handle: parentId },
        { supabaseId: parentId }
      ]
    });
    
    if (!parent) {
      return res.status(404).json({
        status: 'error',
        message: 'Parent not found'
      });
    }
    
    // Find children linked to this parent
    // Note: This assumes User model has a parentId field
    const children = await User.find({
      $or: [
        { parentId: parent._id },
        { supabaseParentId: parent.supabaseId || parentId }
      ]
    }).select('-passwordHash -recoveryKeyHash').lean();
    
    // Enrich with additional data
    const enrichedChildren = await Promise.all(
      children.map(async (child) => {
        const [meritStats, storageStats, recentActivity] = await Promise.all([
          MeritLog.find({
            $or: [
              { userId: child._id },
              { supabaseUserId: child.supabaseId || child._id }
            ]
          }).sort({ createdAt: -1 }).limit(5).lean(),
          StorageLedger.getUserStorageStats(child.supabaseId || child._id.toString()),
          AuditLog.find({
            $or: [
              { userId: child._id },
              { supabaseUserId: child.supabaseId || child._id }
            ]
          }).sort({ createdAt: -1 }).limit(5).lean()
        ]);
        
        return {
          ...child,
          avatar: {
            type: child.meritScore >= 5 ? 'angel' : 'devil',
            level: Math.min(Math.floor(child.meritScore / 2), 3)
          },
          recentMeritActivity: meritStats,
          storageStats,
          recentActivity
        };
      })
    );
    
    res.json({
      status: 'success',
      data: {
        children: enrichedChildren,
        count: enrichedChildren.length
      }
    });
    
  } catch (error) {
    console.error('❌ Get linked children error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get detailed overview of a specific child
 * @route   GET /api/parental/child/:childId
 * @access  Private (Parent only)
 */
exports.getChildOverview = async (req, res) => {
  try {
    const { childId } = req.params;
    
    const child = await User.findOne({
      $or: [
        { _id: childId },
        { handle: childId },
        { supabaseId: childId }
      ]
    }).select('-passwordHash -recoveryKeyHash').lean();
    
    if (!child) {
      return res.status(404).json({
        status: 'error',
        message: 'Child not found'
      });
    }
    
    // Get comprehensive data
    const [
      meritHistory,
      storageStatus,
      paymentHistory,
      auditLogs
    ] = await Promise.all([
      MeritLog.find({
        $or: [
          { userId: child._id },
          { supabaseUserId: child.supabaseId || childId }
        ]
      }).sort({ createdAt: -1 }).limit(20).lean(),
      StorageLedger.find({
        $or: [
          { providerUserId: child._id },
          { consumerUserId: child._id },
          { supabaseProviderId: child.supabaseId || childId },
          { supabaseConsumerId: child.supabaseId || childId }
        ]
      }).sort({ createdAt: -1 }).lean(),
      Payment.find({
        $or: [
          { userId: child._id },
          { supabaseUserId: child.supabaseId || childId }
        ]
      }).sort({ createdAt: -1 }).limit(20).lean(),
      AuditLog.find({
        $or: [
          { userId: child._id },
          { supabaseUserId: child.supabaseId || childId }
        ]
      }).sort({ createdAt: -1 }).limit(20).lean()
    ]);
    
    res.json({
      status: 'success',
      data: {
        profile: {
          ...child,
          avatar: {
            type: child.meritScore >= 5 ? 'angel' : 'devil',
            level: Math.min(Math.floor(child.meritScore / 2), 3)
          }
        },
        meritHistory,
        storageSharing: storageStatus,
        paymentHistory,
        auditLogs
      }
    });
    
  } catch (error) {
    console.error('❌ Get child overview error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Log a parental action
 * @route   POST /api/parental/log-action
 * @access  Private (Parent only)
 */
exports.logParentalAction = async (req, res) => {
  try {
    const { parentId, action, childId, details, severity } = req.body;
    
    const parent = await Parent.findOne({
      $or: [
        { _id: parentId },
        { handle: parentId },
        { supabaseId: parentId }
      ]
    });
    
    if (!parent) {
      return res.status(404).json({
        status: 'error',
        message: 'Parent not found'
      });
    }
    
    // Find child if provided
    let child = null;
    if (childId) {
      child = await User.findOne({
        $or: [
          { _id: childId },
          { handle: childId },
          { supabaseId: childId }
        ]
      });
    }
    
    const auditLog = await AuditLog.create({
      parentId: parent._id,
      supabaseParentId: parent.supabaseId || parentId,
      userId: child?._id || null,
      supabaseUserId: child?.supabaseId || childId || null,
      action,
      details: details || {},
      severity: severity || 'info',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.status(201).json({
      status: 'success',
      message: 'Action logged',
      data: {
        logId: auditLog._id,
        action: auditLog.action,
        category: auditLog.category,
        timestamp: auditLog.createdAt
      }
    });
    
  } catch (error) {
    console.error('❌ Log parental action error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get audit logs for a parent
 * @route   GET /api/parental/audit-logs/:parentId
 * @access  Private (Parent only)
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const { parentId } = req.params;
    const { limit = 100, page = 1, category, severity, requiresReview } = req.query;
    
    const parent = await Parent.findOne({
      $or: [
        { _id: parentId },
        { handle: parentId },
        { supabaseId: parentId }
      ]
    });
    
    if (!parent) {
      return res.status(404).json({
        status: 'error',
        message: 'Parent not found'
      });
    }
    
    const query = {
      $or: [
        { parentId: parent._id },
        { supabaseParentId: parent.supabaseId || parentId }
      ]
    };
    
    if (category) query.category = category;
    if (severity) query.severity = severity;
    if (requiresReview !== undefined) query.requiresReview = requiresReview === 'true';
    
    const skip = (page - 1) * limit;
    
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      AuditLog.countDocuments(query)
    ]);
    
    // Get summary stats
    const stats = await AuditLog.getParentAuditStats(parent.supabaseId || parentId, 30);
    
    res.json({
      status: 'success',
      data: {
        logs,
        stats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Get audit logs error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get audit statistics for a parent
 * @route   GET /api/parental/audit-stats/:parentId
 * @access  Private (Parent only)
 */
exports.getAuditStats = async (req, res) => {
  try {
    const { parentId } = req.params;
    const { days = 30 } = req.query;
    
    const parent = await Parent.findOne({
      $or: [
        { _id: parentId },
        { handle: parentId },
        { supabaseId: parentId }
      ]
    });
    
    if (!parent) {
      return res.status(404).json({
        status: 'error',
        message: 'Parent not found'
      });
    }
    
    const stats = await AuditLog.getParentAuditStats(
      parent.supabaseId || parentId,
      parseInt(days)
    );
    
    res.json({
      status: 'success',
      data: { stats }
    });
    
  } catch (error) {
    console.error('❌ Get audit stats error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Review an audit log entry
 * @route   POST /api/parental/review-log/:logId
 * @access  Private (Parent only)
 */
exports.reviewAuditLog = async (req, res) => {
  try {
    const { logId } = req.params;
    const { reviewerId } = req.body;
    
    const log = await AuditLog.findById(logId);
    
    if (!log) {
      return res.status(404).json({
        status: 'error',
        message: 'Audit log not found'
      });
    }
    
    await log.markReviewed(reviewerId);
    
    res.json({
      status: 'success',
      message: 'Audit log marked as reviewed',
      data: {
        logId: log._id,
        reviewStatus: log.reviewStatus,
        reviewedAt: log.reviewedAt
      }
    });
    
  } catch (error) {
    console.error('❌ Review audit log error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Search audit logs
 * @route   POST /api/parental/search-logs
 * @access  Private (Parent only)
 */
exports.searchAuditLogs = async (req, res) => {
  try {
    const searchResults = await AuditLog.searchLogs(req.body);
    
    res.json({
      status: 'success',
      data: searchResults
    });
    
  } catch (error) {
    console.error('❌ Search audit logs error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
