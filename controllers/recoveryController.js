const User = require('../models/User');
const Parent = require('../models/Parent');
const bcrypt = require('bcryptjs');

/**
 * Handles Account Recovery using the 8-digit key
 * Allows password reset or account deletion
 */
exports.handleAccountRecovery = async (req, res) => {
  const { handle, email, eightDigitKey, action, newPassword } = req.body;

  try {
    // 1. Basic Validation
    if ((!handle && !email) || !eightDigitKey) {
      return res.status(400).json({ error: "Username/Email and 8-digit key are required." });
    }

    if (!/^\d{8}$/.test(eightDigitKey)) {
      return res.status(400).json({ error: "The recovery key must be exactly 8 digits." });
    }

    // 2. Find Account (check both User and Parent)
    let account = await Parent.findOne({ $or: [{ handle }, { email }] });
    let accountType = 'parent';

    if (!account) {
      account = await User.findOne({ $or: [{ handle }, { email }] });
      accountType = 'child';
    }

    if (!account) {
      return res.status(404).json({ error: "Account not found with provided details." });
    }

    // 3. Verify the 8-digit key
    const isMatch = await account.matchRecoveryKey(eightDigitKey);
    if (!isMatch) {
      return res.status(403).json({ error: "Invalid recovery key. Access denied." });
    }

    // 4. Perform Requested Action
    if (action === 'delete') {
      if (accountType === 'parent') {
        await Parent.deleteOne({ _id: account._id });
      } else {
        await User.deleteOne({ _id: account._id });
      }
      return res.status(200).json({ 
        success: true, 
        message: "Account and all associated data permanently deleted. Farewell!" 
      });
    } 
    
    if (action === 'reset-password') {
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters long." });
      }

      // We just set the passwordHash (the pre-save middleware in both models hashes it)
      account.passwordHash = newPassword;
      await account.save();

      return res.status(200).json({ 
        success: true, 
        message: "Password reset successful! You can now log in with your new password." 
      });
    }

    res.status(400).json({ error: "Invalid action requested. Use 'reset-password' or 'delete'." });

  } catch (error) {
    console.error("Recovery Error:", error);
    res.status(500).json({ error: "An error occurred during the recovery process. Please try again later." });
  }
};