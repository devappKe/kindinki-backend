const Payment = require('../models/Payment');
const User = require('../models/User');

/**
 * Payment Controller
 * Handles payment processing and history
 */

const PRICING = {
  ANGEL_TIER_COST: 4.99,
  COSMETICS: {
    halo: 1.99,
    wings: 2.99,
    glow_effect: 1.49,
    particle_aura: 1.99
  }
};

/**
 * @desc    Process angel tier upgrade
 * @route   POST /api/payments/upgrade-angel
 * @access  Private
 */
exports.upgradeToAngelTier = async (req, res) => {
  try {
    const { userId, paymentMethod } = req.body;
    
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
    
    // Check if already has angel tier
    if (user.hasAngelTier) {
      return res.status(400).json({
        status: 'error',
        message: 'User already has angel tier'
      });
    }
    
    // Create payment record
    const payment = await Payment.create({
      userId: user._id,
      supabaseUserId: user.supabaseId || userId,
      transactionType: 'angel_tier_upgrade',
      amount: PRICING.ANGEL_TIER_COST,
      status: 'completed', // Would be 'pending' until processed
      description: 'Angel tier cosmetic upgrade',
      paymentProcessor: paymentMethod || 'stripe',
      processedAt: new Date()
    });
    
    // Update user
    user.hasAngelTier = true;
    await user.save();
    
    res.status(201).json({
      status: 'success',
      message: 'Angel tier upgrade successful',
      data: {
        payment: {
          id: payment._id,
          amount: `$${payment.amount.toFixed(2)}`,
          status: payment.status,
          processedAt: payment.processedAt
        },
        user: {
          id: user._id,
          hasAngelTier: user.hasAngelTier
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Angel tier upgrade error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Purchase cosmetic item
 * @route   POST /api/payments/cosmetic
 * @access  Private
 */
exports.buyCosmeticItem = async (req, res) => {
  try {
    const { userId, itemId, paymentMethod } = req.body;
    
    // Validate item
    if (!PRICING.COSMETICS[itemId]) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid cosmetic item',
        availableItems: Object.keys(PRICING.COSMETICS)
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
    
    const amount = PRICING.COSMETICS[itemId];
    const itemNames = {
      halo: 'Golden Halo',
      wings: 'Angel Wings',
      glow_effect: 'Divine Glow',
      particle_aura: 'Stardust Aura'
    };
    
    // Create payment record
    const payment = await Payment.create({
      userId: user._id,
      supabaseUserId: user.supabaseId || userId,
      transactionType: 'cosmetic_purchase',
      amount,
      status: 'completed',
      description: `Purchased cosmetic: ${itemId}`,
      itemDetails: {
        itemId,
        itemName: itemNames[itemId],
        itemType: itemId
      },
      paymentProcessor: paymentMethod || 'stripe',
      processedAt: new Date()
    });
    
    // Add to user's cosmetics (would need cosmetics array in User model)
    if (!user.cosmetics) user.cosmetics = [];
    user.cosmetics.push(itemId);
    await user.save();
    
    res.status(201).json({
      status: 'success',
      message: 'Cosmetic item purchased',
      data: {
        payment: {
          id: payment._id,
          item: itemNames[itemId],
          amount: `$${amount.toFixed(2)}`,
          status: payment.status
        },
        user: {
          id: user._id,
          cosmetics: user.cosmetics
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Cosmetic purchase error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get payment history for a user
 * @route   GET /api/payments/history/:userId
 * @access  Private
 */
exports.getPaymentHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, page = 1, type, status } = req.query;
    
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
        { userId: user._id },
        { supabaseUserId: user.supabaseId || userId }
      ]
    };
    
    if (type) query.transactionType = type;
    if (status) query.status = status;
    
    const skip = (page - 1) * limit;
    
    const [payments, total] = await Promise.all([
      Payment.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Payment.countDocuments(query)
    ]);
    
    res.json({
      status: 'success',
      data: {
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Get payment history error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get payment summary for a user
 * @route   GET /api/payments/summary/:userId
 * @access  Private
 */
exports.getPaymentSummary = async (req, res) => {
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
    
    const summary = await Payment.getUserPaymentSummary(user.supabaseId || userId);
    
    res.json({
      status: 'success',
      data: {
        summary: {
          ...summary,
          formatted: {
            totalSpent: `$${summary.totalSpent.toFixed(2)}`,
            totalEarned: `$${summary.totalEarned.toFixed(2)}`
          }
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Get payment summary error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Get available products/pricing
 * @route   GET /api/payments/products
 * @access  Public
 */
exports.getProducts = async (req, res) => {
  try {
    res.json({
      status: 'success',
      data: {
        products: {
          angelTier: {
            id: 'angel_tier_upgrade',
            name: 'Angel Tier Upgrade',
            description: 'Unlock premium angel cosmetics and features',
            price: PRICING.ANGEL_TIER_COST,
            features: [
              'Exclusive angel cosmetics',
              'Priority support',
              'Custom avatar effects'
            ]
          },
          cosmetics: Object.entries(PRICING.COSMETICS).map(([id, price]) => ({
            id,
            name: id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            price,
            requiresAngelTier: false
          }))
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Get products error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * @desc    Record storage payout
 * @route   POST /api/payments/storage-payout
 * @access  Private (Internal)
 */
exports.recordStoragePayout = async (req, res) => {
  try {
    const { userId, amount, storageRecordId } = req.body;
    
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
    
    const payment = await Payment.create({
      userId: user._id,
      supabaseUserId: user.supabaseId || userId,
      transactionType: 'storage_payout',
      amount,
      status: 'completed',
      description: `Storage sharing payout for record ${storageRecordId}`,
      storageLedgerId: storageRecordId,
      processedAt: new Date()
    });
    
    res.status(201).json({
      status: 'success',
      message: 'Storage payout recorded',
      data: {
        payment: {
          id: payment._id,
          amount: `$${amount.toFixed(2)}`,
          status: payment.status
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Record storage payout error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
