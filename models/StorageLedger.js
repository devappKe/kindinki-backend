const mongoose = require('mongoose');

/**
 * Storage Ledger Model
 * Synchronizes with Supabase storage_ledger table
 * Tracks storage sharing transactions between users
 */
const storageLedgerSchema = new mongoose.Schema({
  // Sync with Supabase UUID
  supabaseId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  
  // Provider (user sharing storage)
  providerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  supabaseProviderId: {
    type: String,
    required: true,
    index: true
  },
  
  // Consumer (user using the storage)
  consumerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  supabaseConsumerId: {
    type: String,
    required: true,
    index: true
  },
  
  // Storage details
  storageSizeBytes: {
    type: Number,
    required: true,
    min: 0
  },
  
  storageSizeGB: {
    type: Number,
    required: true
  },
  
  // Payout details
  payoutAmount: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  
  payoutRatePerGB: {
    type: Number,
    default: 0.5 // $0.50 per GB
  },
  
  // Transaction status
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled'],
    default: 'active',
    index: true
  },
  
  // Timestamps
  startedAt: {
    type: Date,
    default: Date.now
  },
  
  completedAt: {
    type: Date,
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
  },
  
  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
storageLedgerSchema.index({ supabaseProviderId: 1, status: 1 });
storageLedgerSchema.index({ supabaseConsumerId: 1, status: 1 });
storageLedgerSchema.index({ status: 1, createdAt: -1 });

// Virtual for formatted storage size
storageLedgerSchema.virtual('formattedStorageSize').get(function() {
  const gb = this.storageSizeBytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(2)} GB`;
  }
  const mb = this.storageSizeBytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
});

// Pre-save middleware to calculate derived fields
storageLedgerSchema.pre('save', function(next) {
  // Calculate storage size in GB
  this.storageSizeGB = this.storageSizeBytes / (1024 * 1024 * 1024);
  
  // Calculate payout if not set
  if (this.isModified('storageSizeBytes') && this.payoutAmount === 0) {
    this.payoutAmount = this.storageSizeGB * this.payoutRatePerGB;
  }
  
  // Set completedAt when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  next();
});

// Static method to sync from Supabase
storageLedgerSchema.statics.syncFromSupabase = async function(storageData) {
  const {
    id,
    provider_user_id,
    consumer_user_id,
    storage_size_bytes,
    payout_amount,
    status,
    created_at,
    updated_at
  } = storageData;

  // Find associated MongoDB users if they exist
  const User = mongoose.model('User');
  
  const [provider, consumer] = await Promise.all([
    User.findOne({ supabaseId: provider_user_id }),
    User.findOne({ supabaseId: consumer_user_id })
  ]);

  const updateData = {
    supabaseId: id,
    supabaseProviderId: provider_user_id,
    providerUserId: provider?._id || null,
    supabaseConsumerId: consumer_user_id,
    consumerUserId: consumer?._id || null,
    storageSizeBytes: storage_size_bytes,
    storageSizeGB: storage_size_bytes / (1024 * 1024 * 1024),
    payoutAmount: payout_amount || (storage_size_bytes / (1024 * 1024 * 1024) * 0.5),
    status: status,
    lastSyncedAt: new Date(),
    syncStatus: 'synced'
  };

  if (created_at) {
    updateData.startedAt = new Date(created_at);
    updateData.createdAt = new Date(created_at);
  }
  
  if (updated_at) {
    updateData.updatedAt = new Date(updated_at);
  }
  
  if (status === 'completed' && !updateData.completedAt) {
    updateData.completedAt = new Date();
  }

  return this.findOneAndUpdate(
    { supabaseId: id },
    updateData,
    { upsert: true, new: true }
  );
};

// Instance method to complete storage record
storageLedgerSchema.methods.complete = async function(finalPayoutAmount) {
  this.status = 'completed';
  this.payoutAmount = finalPayoutAmount || this.payoutAmount;
  this.completedAt = new Date();
  return this.save();
};

// Static method to get user's storage stats
storageLedgerSchema.statics.getUserStorageStats = async function(supabaseUserId) {
  const stats = await this.aggregate([
    {
      $match: {
        $or: [
          { supabaseProviderId: supabaseUserId },
          { supabaseConsumerId: supabaseUserId }
        ],
        status: { $in: ['active', 'completed'] }
      }
    },
    {
      $group: {
        _id: null,
        totalShared: {
          $sum: {
            $cond: [{ $eq: ['$supabaseProviderId', supabaseUserId] }, '$storageSizeBytes', 0]
          }
        },
        totalUsed: {
          $sum: {
            $cond: [{ $eq: ['$supabaseConsumerId', supabaseUserId] }, '$storageSizeBytes', 0]
          }
        },
        totalPayoutEarned: {
          $sum: {
            $cond: [{ $eq: ['$supabaseProviderId', supabaseUserId] }, '$payoutAmount', 0]
          }
        },
        totalPaid: {
          $sum: {
            $cond: [{ $eq: ['$supabaseConsumerId', supabaseUserId] }, '$payoutAmount', 0]
          }
        },
        activeShares: {
          $sum: {
            $cond: [
              { 
                $and: [
                  { $eq: ['$supabaseProviderId', supabaseUserId] },
                  { $eq: ['$status', 'active'] }
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

  return stats[0] || {
    totalShared: 0,
    totalUsed: 0,
    totalPayoutEarned: 0,
    totalPaid: 0,
    activeShares: 0
  };
};

module.exports = mongoose.model('StorageLedger', storageLedgerSchema);
