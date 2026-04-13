const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();

// Invite Schema
const InviteSchema = new mongoose.Schema({
  code: { 
    type: String, 
    unique: true, 
    required: true,
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
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Parent'
  },
  supabaseParentId: {
    type: String
  }
}, { timestamps: true });

const Invite = mongoose.model('Invite', InviteSchema);

async function createInviteCode() {
  try {
    // Connect to MongoDB
    const dbURI = process.env.MONGO_URI;
    if (!dbURI) {
      throw new Error("MONGO_URI is missing from your .env file!");
    }

    await mongoose.connect(dbURI, { autoIndex: true });
    console.log('✨ Connected to MongoDB');

    // Generate invite code
    const rawCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const fullCode = `KIN-${rawCode}`;

    // Set expiration to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create invite
    const newInvite = await Invite.create({
      code: fullCode,
      expiresAt: expiresAt
    });

    console.log('\n✅ Invite Code Created Successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Code:       ${newInvite.code}`);
    console.log(`Expires:    ${newInvite.expiresAt.toISOString()}`);
    console.log(`Status:     Unused`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nUser Registration Details:');
    console.log(`Username:   yung`);
    console.log(`Email:      test@example.com`);
    console.log(`Password:   123456`);
    console.log(`\nUse "${newInvite.code}" as the invite code during registration.`);

    await mongoose.disconnect();
    console.log('\n✨ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createInviteCode();
