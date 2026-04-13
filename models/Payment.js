const mongoose = require('mongoose');

/**
 * Payment Model
 * Synchronizes with Supabase payments table
 * Tracks all payment transactions including angel tier upgrades and cosmetic purchases
 */
const paymentSchema = new mongoose.Schema({
  // Sync with Supabase UUID
  supabaseId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  
  // User who made the payment
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  supabaseUserId: {
    type: String,
    required: true,
    index: true
  },
  
  // Transaction details
  transactionType: {
    type: String,
    enum: ['angel_tier_upgrade', 'storage_payout', 'cosmetic_purchase', 'refund'],
    required: true,
    index: true
  },
  
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  currency: {
    type: String,
    default: 'USD'
  },
  
  // Transaction status
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
    index: true
  },
  
  // Description of the transaction
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // For cosmetic purchases - store item details
  itemDetails: {
    itemId: String,
    itemName: String,
    itemType: {
      type: String,
      enum: ['halo', 'wings', 'glow_effect', 'particle_aura', 'other']
    }
  },
  
  // For storage payouts - reference to storage ledger
  storageLedgerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StorageLedger',
    default: null
  },
  
  supabaseStorageLedgerId: {
    type: String,
    default: null
  },
  
  // Payment processor details (Stripe, etc.)
  paymentProcessor: {
    type: String,
    enum: ['stripe', 'paypal', 'internal', 'other'],
    default: 'internal'
  },
  
  processorTransactionId: {
    type: String,
    default: null,
    index: true
  },
  
  // Receipt/invoice information
  receiptUrl: {
    type: String,
    default: null
  },
  
  invoiceNumber: {
    type: String,
    default: null,
    index: true
  },
  
  // Timestamps
  processedAt: {
    type: Date,
    default: null
  },
  
  failedAt: {
    type: Date,
    default: null
  },
  
  failureReason: {
    type: String,
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
paymentSchema.index({ supabaseUserId: 1, createdAt: -1 });
paymentSchema.index({ transactionType: 1, status: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });

// Virtual for formatted amount
paymentSchema.virtual('formattedAmount').get(function() {
  return `$${this.amount.toFixed(2)}`;
});

// Static method to sync from Supabase
paymentSchema.statics.syncFromSupabase = async function(paymentData) {
  const {
    id,
    user_id,
    transaction_type,
    amount,
    status,
    description,
    created_at,
    updated_at
  } = paymentData;

  // Find associated MongoDB user if exists
  const User = mongoose.model('User');
  const user = await User.findOne({ supabaseId: user_id });

  const updateData = {
    supabaseId: id,
    supabaseUserId: user_id,
    userId: user?._id || null,
    transactionType: transaction_type,
    amount: amount,
    status: status,
    description: description,
    lastSyncedAt: new Date(),
    syncStatus: 'synced'
  };

  // Parse item details from description for cosmetic purchases
  if (transaction_type === 'cosmetic_purchase' && description) {
    const match = description.match(/Purchased cosmetic: (\w+)/);
    if (match) {
      const itemId = match[1];
      const itemNames = {
        halo: 'Golden Halo',
        wings: 'Angel Wings',
        glow_effect: 'Divine Glow',
        particle_aura: 'Stardust Aura'
      };
      updateData.itemDetails = {
        itemId: itemId,
        itemName: itemNames[itemId] || itemId,
        itemType: itemId
      };
    }
  }

  if (created_at) {
    updateData.createdAt = new Date(created_at);
  }
  
  if (updated_at) {
    updateData.updatedAt = new Date(updated_at);
  }
  
  if (status === 'completed' && !updateData.processedAt) {
    updateData.processedAt = new Date();
  }
  
  if (status === 'failed' && !updateData.failedAt) {
    updateData.failedAt = new Date();
  }

  return this.findOneAndUpdate(
    { supabaseId: id },
    updateData,
    { upsert: true, new: true }
  );
};

// Instance method to mark as completed
paymentSchema.methods.markCompleted = async function(processorTransactionId) {
  this.status = 'completed';
  this.processedAt = new Date();
  if (processorTransactionId) {
    this.processorTransactionId = processorTransactionId;
  }
  return this.save();
};

// Instance method to mark as failed
paymentSchema.methods.markFailed = async function(reason) {
  this.status = 'failed';
  this.failedAt = new Date();
  this.failureReason = reason;
  return this.save();
};

// Static method to get user payment summary
paymentSchema.statics.getUserPaymentSummary = async function(supabaseUserId) {
  const summary = await this.aggregate([
    {
      $match: {
        supabaseUserId: supabaseUserId,
        status: 'completed'
      }
    },
    {
      $group: {
        _id: '$transactionType',
        totalAmount: { $sum: '$amount' },
        transactionCount: { $sum: 1 }
      }
    }
  ]);

  const result = {
    totalSpent: 0,
    totalEarned: 0,
    angelTierPurchased: false,
    cosmeticsPurchased: [],
    storagePayoutsReceived: 0,
    transactionCounts: {}
  };

  summary.forEach(item => {
    result.transactionCounts[item._id] = item.transactionCount;
    
    switch (item._id) {
      case 'angel_tier_upgrade':
        result.totalSpent += item.totalAmount;
        result.angelTierPurchased = true;
        break;
      case 'cosmetic_purchase':
        result.totalSpent += item.totalAmount;
        break;
      case 'storage_payout':
        result.totalEarned += item.totalAmount;
        result.storagePayoutsReceived = item.transactionCount;
        break;
    }
  });

  // Get list of purchased cosmetics
  const cosmetics = await this.find({
    supabaseUserId: supabaseUserId,
    transactionType: 'cosmetic_purchase',
    status: 'completed'
  }).select('itemDetails.itemId');
  
  result.cosmeticsPurchased = cosmetics
    .filter(c => c.itemDetails && c.itemDetails.itemId)
    .map(c => c.itemDetails.itemId);

  return result;
};

// Static constants for pricing
paymentSchema.statics.PRICING = {
  ANGEL_TIER_COST: 4.99,
  COSMETICS: {
    halo: 1.99,
    wings: 2.99,
    glow_effect: 1.49,
    particle_aura: 1.99
  },
  STORAGE_PAYOUT_PER_GB: 0.50
};

module.exports = mongoose.model('Payment', paymentSchema);
