// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Parent = require('../models/Parent');

const protectRoute = async (req, res, next) => {
  let token;

  // Check if token is sent in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // Decode and verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Search both User and Parent collections
      let user = await User.findById(decoded.id).select('-passwordHash -recoveryKeyHash');
      
      if (!user) {
        user = await Parent.findById(decoded.id).select('-password -recoveryKey');
      }

      if (!user) {
        return res.status(401).json({ error: "Not authorized, user not found." });
      }

      // Attach the user to the request object
      req.user = user;
      
      next(); // Move on to the actual route logic
    } catch (error) {
      return res.status(401).json({ error: "Not authorized, token failed." });
    }
  }

  if (!token) {
    return res.status(401).json({ error: "Not authorized, no token provided." });
  }
};

module.exports = { protectRoute };