const MeritLog = require('../models/MeritLog');
const User = require('../models/User');
const syncService = require('../services/syncService');

/**
 * Merit Controller
 * Handles merit score operations and history
 */

/**
 * @desc    Get merit history for a user
 * @route   GET /api/merit/history/:userId
 * @access  Private
 */
exports.getMeritHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, page = 1 } = req.query;
    
    // Find user by handle or ID
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
    
    // Get merit logs
    const query = {
      $or: [
        { userId: user._id },
        { supabaseUserId: user.supabaseId || userId }
      ]
    };
    
    const skip = (page - 1) * limit;
    
    const [logs, total] = await Promise.all([
      MeritLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      MeritLog.countDocuments(query)
    ]);
    
    res.json({
      status: 'success',
      data: {
        logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Get merit history error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get merit stats for a user
 * @route   GET /api/merit/stats/:userId
 * @access  Private
 */
exports.getMeritStats = async (req, res) => {
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
    
    // Calculate stats
    const query = {
      $or: [
        { userId: user._id },
        { supabaseUserId: user.supabaseId || userId }
      ]
    };
    
    const stats = await MeritLog.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalChanges: { $sum: 1 },
          averageChange: { $avg: '$scoreChange' },
          maxScore: { $max: '$newScore' },
          minScore: { $min: '$newScore' },
          totalPositiveChanges: {
            $sum: { $cond: [{ $gt: ['$scoreChange', 0] }, 1, 0] }
          },
          totalNegativeChanges: {
            $sum: { $cond: [{ $lt: ['$scoreChange', 0] }, 1, 0] }
          }
        }
      }
    ]);
    
    // Get current avatar state
    const currentAvatar = {
      type: user.meritScore >= 5 ? 'angel' : 'devil',
      level: Math.min(Math.floor(user.meritScore / 2), 3)
    };
    
    res.json({
      status: 'success',
      data: {
        currentScore: user.meritScore,
        currentAvatar,
        stats: stats[0] || {
          totalChanges: 0,
          averageChange: 0,
          maxScore: user.meritScore,
          minScore: user.meritScore,
          totalPositiveChanges: 0,
          totalNegativeChanges: 0
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Get merit stats error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Calculate avatar state from merit score
 * @route   POST /api/merit/calculate-avatar
 * @access  Private
 */
exports.calculateAvatar = async (req, res) => {
  try {
    const { score } = req.body;
    
    if (typeof score !== 'number' || score < 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid score required'
      });
    }
    
    const type = score >= 5 ? 'angel' : 'devil';
    let level = 0;
    
    if (score < 0) level = 0;
    else if (score >= 5 && score < 7) level = 1;
    else if (score >= 7 && score < 9) level = 2;
    else if (score >= 9) level = 3;
    else level = Math.floor(score / 2);
    
    res.json({
      status: 'success',
      data: {
        score,
        avatar: {
          type,
          level: Math.min(level, 3)
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Calculate avatar error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get leaderboard (top merit scores)
 * @route   GET /api/merit/leaderboard
 * @access  Private
 */
exports.getLeaderboard = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const leaderboard = await User.find()
      .select('handle meritScore role createdAt')
      .sort({ meritScore: -1 })
      .limit(parseInt(limit))
      .lean();
    
    const ranked = leaderboard.map((user, index) => ({
      rank: index + 1,
      handle: user.handle,
      meritScore: user.meritScore,
      avatar: {
        type: user.meritScore >= 5 ? 'angel' : 'devil',
        level: Math.min(Math.floor(user.meritScore / 2), 3)
      },
      role: user.role
    }));
    
    res.json({
      status: 'success',
      data: {
        leaderboard: ranked
      }
    });
    
  } catch (error) {
    console.error('❌ Get leaderboard error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get recent merit activity (for dashboard)
 * @route   GET /api/merit/recent
 * @access  Private
 */
exports.getRecentActivity = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const recent = await MeritLog.find()
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .select('action avatarType avatarLevel scoreChange changeReason createdAt')
      .lean();
    
    res.json({
      status: 'success',
      data: {
        activity: recent
      }
    });
    
  } catch (error) {
    console.error('❌ Get recent activity error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
/**
 * @desc    Update merit score for a user
 * @route   POST /api/merit/update-score
 * @access  Private
 */
exports.updateMeritScore = async (req, res) => {
  try {
    const { userId, scoreChange, reason } = req.body;
    
    // Find user (Child only for merit updates usually)
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
        message: 'User (child) not found'
      });
    }
    
    const previousScore = user.meritScore;
    user.meritScore = Math.max(0, user.meritScore + scoreChange);
    
    // Calculate avatar state after update
    const avatar = {
      type: user.meritScore >= 5 ? 'angel' : 'devil',
      level: Math.min(Math.floor(user.meritScore / 2), 3)
    };
    
    await user.save();
    
    // Create merit log entry
    const meritLog = await MeritLog.create({
      userId: user._id,
      supabaseUserId: user.supabaseId || userId,
      previousScore,
      newScore: user.meritScore,
      scoreChange,
      changeReason: reason || 'Parental adjustment',
      avatarType: avatar.type,
      avatarLevel: avatar.level,
      syncStatus: 'pending'
    });
    
    // Synchronize to Supabase in the background
    try {
      // 1. Sync updated user score
      await syncService.syncUserToSupabase(user);
      
      // 2. Sync merit log
      await syncService.syncMeritLogToSupabase(meritLog);
      
      console.log(`✅ Merit update synced for user: ${user.handle}`);
    } catch (syncError) {
      console.error('⚠️  Background Supabase sync failed during merit update:', syncError.message);
    }
    
    res.json({
      status: 'success',
      data: {
        handle: user.handle,
        previousScore,
        newScore: user.meritScore,
        avatar
      }
    });
    
  } catch (error) {
    console.error('❌ Update merit score error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
