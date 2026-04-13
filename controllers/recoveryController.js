const User = require('../models/User');
const bcrypt = require('bcryptjs');

/**
 * Handles Account Recovery or Permanent Deletion
 * STRICTLY uses the 8-digit key
 */
exports.handleAccountRecovery = async (req, res) => {
  const { handle, eightDigitKey, action } = req.body;

  try {
    // 1. Basic Validation
    if (!handle || !eightDigitKey) {
      return res.status(400).json({ error: "Handle and 8-digit key are required." });
    }

    if (!/^\d{8}$/.test(eightDigitKey)) {
      return res.status(400).json({ error: "The recovery key must be exactly 8 digits." });
    }

    // 2. Find User
    const user = await User.findOne({ handle });
    if (!user) {
      return res.status(404).json({ error: "Account not found." });
    }

    // 3. Verify the 8-digit key against the hash
    const isMatch = await bcrypt.compare(eightDigitKey, user.recoveryKeyHash);
    if (!isMatch) {
      return res.status(403).json({ error: "Invalid recovery key. Access denied." });
    }

    // 4. Perform Requested Action
    if (action === 'delete') {
      await User.deleteOne({ _id: user._id });
      return res.status(200).json({ 
        success: true, 
        message: "Account and all data permanently deleted." 
      });
    } 
    
    if (action === 'recover') {
      // Logic for password reset token or manual override goes here
      return res.status(200).json({ 
        success: true, 
        message: "Recovery successful. You may now reset your login password." 
      });
    }

    res.status(400).json({ error: "Invalid action requested." });

  } catch (error) {
    console.error("Recovery Error:", error);
    res.status(500).json({ error: "Internal server error during recovery process." });
  }
};