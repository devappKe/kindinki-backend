const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const ParentSchema = new mongoose.Schema({
  handle: { 
    type: String, 
    unique: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  // The 8-digit key for recovery/deletion
  recoveryKey: { 
    type: String, 
    required: true 
  },
  meritScore: { 
    type: Number, 
    default: 5, // Everyone starts as an Angel
    min: 0, 
    max: 5 
  },
  inviteCodeUsed: { 
    type: String, 
    required: true 
  },
  // Supabase Sync Fields
  supabaseId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  lastSyncedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// LOGIC: Auto-generate handle if missing & Hash the Recovery Key
ParentSchema.pre('save', async function(next) {
  // 1. Generate Handle if empty
  if (!this.handle) {
    this.handle = `Parent_${crypto.randomBytes(3).toString('hex')}`;
  }

  // 2. Hash the 8-digit recoveryKey (treat it like a second password)
  if (this.isModified('recoveryKey')) {
    const salt = await bcrypt.genSalt(10);
    this.recoveryKey = await bcrypt.hash(this.recoveryKey, salt);
  }

  next();
});

// Method to verify 8-digit key
ParentSchema.methods.matchRecoveryKey = async function(enteredKey) {
  return await bcrypt.compare(enteredKey, this.recoveryKey);
};

module.exports = mongoose.model('Parent', ParentSchema);