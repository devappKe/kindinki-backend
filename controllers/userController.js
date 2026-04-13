const User = require('../models/User');

exports.getUserProfile = async (req, res) => {
  try {
    // req.user was populated by our protectRoute middleware!
    const user = await User.findById(req.user._id).select('-passwordHash -recoveryKeyHash');
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      data: {
        handle: user.handle,
        meritScore: user.meritScore, // 5 = Angel, 0-2 = Horrific Devil [cite: 2026-01-10]
        role: user.role,
        joinedAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};