const mongoose = require('mongoose');

const InviteSchema = new mongoose.Schema({
  code: { 
    type: String, 
    unique: true, 
    required: [true, 'Invite code is required'],
    trim: true,
    uppercase: true
  },
  isUsed: { 
    type: Boolean, 
    default: false 
  },
  usedByHandle: {
    type: String, 
    default: null 
  },
  // Set the 7-day limit or use the provided date
  expiresAt: {
    type: Date,
    required: [true, 'Expiration date is required'],
    index: { expires: 0 } // Automatically deletes the document from MongoDB when it expires
  },
  // Reference to the parent who created it
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parent'
  },
  supabaseParentId: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Invite', InviteSchema);