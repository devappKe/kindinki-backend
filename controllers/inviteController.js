const Invite = require('../models/Invite'); 
const crypto = require('crypto');

/**
 * Generate a new unique invite code
 */
exports.generateInviteCode = async (req, res) => {
  try {
    const rawCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const fullCode = `KIN-${rawCode}`;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Track the Parent ID natively via the Protected Route token
    const newInvite = await Invite.create({
      code: fullCode,
      expiresAt: expiresAt,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      invite: newInvite
    });
  } catch (error) {
    console.error("❌ INVITE GENERATION ERROR:", error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate invite code',
      details: error.message 
    });
  }
};

/**
 * Fetch all invites specifically created by the requesting Parent
 */
exports.getMyInvites = async (req, res) => {
  try {
    const invites = await Invite.find({ createdBy: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: invites
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch invites' });
  }
};

/**
 * Internal helper to validate a code during registration
 */
exports.checkInviteCode = async (code) => {
  // SAFETY CHECK: Prevent the toUpperCase() crash if code is missing
  if (!code) {
    return { valid: false, message: 'Invite code is missing from request' };
  }

  // Universal testing bypass
  if (code === 'KIN-TEST') {
    return { valid: true, invite: { _id: null, createdBy: null } };
  }

  // Now it is safe to use toUpperCase()
  const invite = await Invite.findOne({ code: code.toUpperCase() });
  
  if (!invite) return { valid: false, message: 'HELLO CAN YOU HEAR ME' };
  if (invite.isUsed) return { valid: false, message: 'Code already used' };
  if (new Date() > invite.expiresAt) return { valid: false, message: 'Code expired' };

  return { valid: true, invite };
};

/**
 * Mark code as used after successful registration
 */
exports.markInviteCodeUsed = async (code, handle) => {
  // SAFETY CHECK: Prevent crash
  if (!code) return;

  await Invite.findOneAndUpdate(
    { code: code.toUpperCase() },
    { isUsed: true, usedByHandle: handle }
  );
};