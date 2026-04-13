const mongoose = require('mongoose');

/**
 * Merit Log Model
 * Synchronizes with Supabase merit_logs table
 * Tracks all merit score changes for users
 */
const meritLogSchema = new mongoose.Schema({
  // Sync with Supabase UUID
  supabaseId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  
  // Reference to user in MongoDB (if synced)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  // Supabase user_profile ID for cross-reference
  supabaseUserId: {
    type: String,
    required: true,
    index: true
  },
  
  previousScore: {
    type: Number,
    required: true,
    min: 0
  },
  
  newScore: {
    type: Number,
    required: true,
    min: 0
  },
  
  scoreChange: {
    type: Number,
    required: true
  },
  
  changeReason: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  
  // Parent who made the change (if applicable)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parent',
    default: null
  },
  
  supabaseParentId: {
    type: String,
    default: null
  },
  
  // Avatar state after change
  avatarType: {
    type: String,
    enum: ['devil', 'angel'],
    required: true
  },
  
  avatarLevel: {
    type: Number,
    min: 0,
    max: 3,
    required: true
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

// Index for efficient querying
meritLogSchema.index({ supabaseUserId: 1, createdAt: -1 });
meritLogSchema.index({ userId: 1, createdAt: -1 });

// Static method to sync from Supabase
meritLogSchema.statics.syncFromSupabase = async function(meritLogData) {
  const {
    id,
    user_id,
    previous_score,
    new_score,
    change_reason,
    created_by,
    created_at,
    avatar_type,
    avatar_level
  } = meritLogData;

  // Find associated MongoDB user if exists
  const User = mongoose.model('User');
  const Parent = mongoose.model('Parent');
  
  const [user, parent] = await Promise.all([
    User.findOne({ supabaseId: user_id }),
    created_by ? Parent.findOne({ supabaseId: created_by }) : Promise.resolve(null)
  ]);

  const updateData = {
    supabaseId: id,
    supabaseUserId: user_id,
    userId: user?._id || null,
    previousScore: previous_score,
    newScore: new_score,
    scoreChange: new_score - previous_score,
    changeReason: change_reason,
    supabaseParentId: created_by,
    createdBy: parent?._id || null,
    avatarType: avatar_type || (new_score >= 5 ? 'angel' : 'devil'),
    avatarLevel: avatar_level || Math.min(Math.floor(new_score / 2), 3),
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

// Instance method to calculate avatar state
meritLogSchema.methods.calculateAvatarState = function() {
  const score = this.newScore;
  return {
    type: score >= 5 ? 'angel' : 'devil',
    level: Math.min(Math.floor(score / 2), 3)
  };
};

module.exports = mongoose.model('MeritLog', meritLogSchema);
