const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  role: { 
    type: String, 
    enum: ['parent', 'child'], 
    required: true 
  },
  handle: { 
    type: String, 
    unique: true, 
    required: true 
  }, 
  email: {
    type: String,
    unique: true,
    required: true
  },
  passwordHash: { 
    type: String, 
    required: true 
  },
  inviteCodeUsed: { 
    type: String, 
    required: true 
  },
  recoveryKeyHash: { 
    type: String, 
    required: true 
  },
  meritScore: { 
    type: Number, 
    default: 0 // 0-2 = Horrific Devil, 3-4 = Less Horrific, 5+ = Angel
  },
  ageGroup: {
    type: String,
    enum: ['6-11', '12-16'],
    default: '12-16'
  },
  // Supabase Sync Fields
  supabaseId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  supabaseProfileId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  // Parental Linking
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parent',
    index: true
  },
  supabaseParentId: {
    type: String,
    index: true
  },
  // Feature Flags & Cosmetics
  hasAngelTier: {
    type: Boolean,
    default: false
  },
  cosmetics: {
    type: [String],
    default: []
  },
  isStorageSharingEnabled: {
    type: Boolean,
    default: false
  },
  lastSyncedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

/**
 * Pre-save middleware
 * Automatically hashes both the Login Password and the 8-Digit Recovery Key
 */
userSchema.pre('save', async function(next) {
  // Hash the login password if it's new or changed
  if (this.isModified('passwordHash')) {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  }

  // Hash the 8-digit recovery key if it's new or changed
  if (this.isModified('recoveryKeyHash')) {
    const salt = await bcrypt.genSalt(10);
    this.recoveryKeyHash = await bcrypt.hash(this.recoveryKeyHash, salt);
  }

  next();
});

// Method to verify standard login password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

// Method to verify 8-digit key for account deletion/recovery
userSchema.methods.matchRecoveryKey = async function(enteredKey) {
  return await bcrypt.compare(enteredKey, this.recoveryKeyHash);
};

module.exports = mongoose.model('User', userSchema);