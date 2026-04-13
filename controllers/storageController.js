const StorageLedger = require('../models/StorageLedger');
const User = require('../models/User');

/**
 * Storage Controller
 * Handles storage sharing operations
 */

const PAYOUT_PER_GB = 0.5; // $0.50 per GB

/**
 * @desc    Create storage sharing record
 * @route   POST /api/storage/share
 * @access  Private
 */
exports.createStorageRecord = async (req, res) => {
  try {
    const { providerUserId, consumerUserId, storageSizeBytes } = req.body;
    
    // Validate required fields
    if (!providerUserId || !consumerUserId || !storageSizeBytes) {
      return res.status(400).json({
        status: 'error',
        message: 'Provider ID, consumer ID, and storage size are required'
      });
    }
    
    // Find users
    const [provider, consumer] = await Promise.all([
      User.findOne({
        $or: [
          { _id: providerUserId },
          { handle: providerUserId },
          { supabaseId: providerUserId }
        ]
      }),
      User.findOne({
        $or: [
          { _id: consumerUserId },
          { handle: consumerUserId },
          { supabaseId: consumerUserId }
        ]
      })
    ]);
    
    if (!provider) {
      return res.status(404).json({
        status: 'error',
        message: 'Provider user not found'
      });
    }
    
    if (!consumer) {
      return res.status(404).json({
        status: 'error',
        message: 'Consumer user not found'
      });
    }
    
    // Calculate payout
    const storageGB = storageSizeBytes / (1024 * 1024 * 1024);
    const payoutAmount = storageGB * PAYOUT_PER_GB;
    
    // Create storage record
    const storageRecord = await StorageLedger.create({
      providerUserId: provider._id,
      supabaseProviderId: provider.supabaseId || providerUserId,
      consumerUserId: consumer._id,
      supabaseConsumerId: consumer.supabaseId || consumerUserId,
      storageSizeBytes,
      storageSizeGB: storageGB,
      payoutAmount,
      payoutRatePerGB: PAYOUT_PER_GB,
      status: 'active'
    });
    
    res.status(201).json({
      status: 'success',
      message: 'Storage sharing record created',
      data: {
        record: storageRecord,
        formattedStorage: storageRecord.formattedStorageSize,
        payoutAmount: `$${payoutAmount.toFixed(2)}`
      }
    });
    
  } catch (error) {
    console.error('❌ Create storage record error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get storage ledger for a user
 * @route   GET /api/storage/ledger/:userId
 * @access  Private
 */
exports.getStorageLedger = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, page = 1, limit = 50 } = req.query;
    
    const user = await User.findOne({
      $or: [
        { _id: userId },
        { handle: userId },
        { supabaseId: userId }
      ]
    });
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    // Build query
    const query = {
      $or: [
        { providerUserId: user._id },
        { consumerUserId: user._id },
        { supabaseProviderId: user.supabaseId || userId },
        { supabaseConsumerId: user.supabaseId || userId }
      ]
    };
    
    if (status) {
      query.status = status;
    }
    
    const skip = (page - 1) * limit;
    
    const [records, total] = await Promise.all([
      StorageLedger.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      StorageLedger.countDocuments(query)
    ]);
    
    // Add formatted storage size to each record
    const formattedRecords = records.map(record => ({
      ...record,
      formattedStorageSize: `${(record.storageSizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
    }));
    
    res.json({
      status: 'success',
      data: {
        records: formattedRecords,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Get storage ledger error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get storage stats for a user
 * @route   GET /api/storage/stats/:userId
 * @access  Private
 */
exports.getStorageStats = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findOne({
      $or: [
        { _id: userId },
        { handle: userId },
        { supabaseId: userId }
      ]
    });
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    const supabaseUserId = user.supabaseId || userId;
    const stats = await StorageLedger.getUserStorageStats(supabaseUserId);
    
    res.json({
      status: 'success',
      data: {
        ...stats,
        formatted: {
          totalShared: `${(stats.totalShared / (1024 * 1024 * 1024)).toFixed(2)} GB`,
          totalUsed: `${(stats.totalUsed / (1024 * 1024 * 1024)).toFixed(2)} GB`,
          totalPayoutEarned: `$${stats.totalPayoutEarned.toFixed(2)}`,
          totalPaid: `$${stats.totalPaid.toFixed(2)}`
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Get storage stats error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Toggle storage sharing for a user
 * @route   POST /api/storage/toggle
 * @access  Private
 */
exports.toggleStorageSharing = async (req, res) => {
  try {
    const { userId, enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        status: 'error',
        message: 'Enabled must be a boolean'
      });
    }
    
    const user = await User.findOne({
      $or: [
        { _id: userId },
        { handle: userId },
        { supabaseId: userId }
      ]
    });
    
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    
    // Update user's storage sharing preference
    // Note: This would need a field added to User model
    user.isStorageSharingEnabled = enabled;
    await user.save();
    
    res.json({
      status: 'success',
      message: `Storage sharing ${enabled ? 'enabled' : 'disabled'}`,
      data: {
        userId: user._id,
        isStorageSharingEnabled: enabled
      }
    });
    
  } catch (error) {
    console.error('❌ Toggle storage sharing error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Complete storage record
 * @route   POST /api/storage/complete/:recordId
 * @access  Private
 */
exports.completeStorageRecord = async (req, res) => {
  try {
    const { recordId } = req.params;
    const { finalPayoutAmount } = req.body;
    
    const record = await StorageLedger.findById(recordId);
    
    if (!record) {
      return res.status(404).json({
        status: 'error',
        message: 'Storage record not found'
      });
    }
    
    if (record.status === 'completed') {
      return res.status(400).json({
        status: 'error',
        message: 'Storage record already completed'
      });
    }
    
    await record.complete(finalPayoutAmount);
    
    res.json({
      status: 'success',
      message: 'Storage record completed',
      data: {
        recordId: record._id,
        status: record.status,
        payoutAmount: `$${record.payoutAmount.toFixed(2)}`,
        completedAt: record.completedAt
      }
    });
    
  } catch (error) {
    console.error('❌ Complete storage record error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Cancel storage record
 * @route   POST /api/storage/cancel/:recordId
 * @access  Private
 */
exports.cancelStorageRecord = async (req, res) => {
  try {
    const { recordId } = req.params;
    
    const record = await StorageLedger.findById(recordId);
    
    if (!record) {
      return res.status(404).json({
        status: 'error',
        message: 'Storage record not found'
      });
    }
    
    if (record.status !== 'active') {
      return res.status(400).json({
        status: 'error',
        message: `Cannot cancel storage record with status: ${record.status}`
      });
    }
    
    record.status = 'cancelled';
    record.updatedAt = new Date();
    await record.save();
    
    res.json({
      status: 'success',
      message: 'Storage record cancelled',
      data: {
        recordId: record._id,
        status: record.status
      }
    });
    
  } catch (error) {
    console.error('❌ Cancel storage record error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
