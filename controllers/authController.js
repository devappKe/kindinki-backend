const User = require('../models/User');
const Parent = require('../models/Parent');
const jwt = require('jsonwebtoken');
const { checkInviteCode, markInviteCodeUsed } = require('./inviteController');
const syncService = require('../services/syncService');

// --- REGISTRATION LOGIC ---
exports.registerParent = async (req, res) => {
  try {
    const { inviteCode, requestedHandle, password, eightDigitKey, email } = req.body;

    // Generate random 8-digit key if not provided
    const finalRecoveryKey = eightDigitKey || Math.floor(10000000 + Math.random() * 90000000).toString();


    // 1. Check Invite Code (Bypass for Parent Bootstrapping if 'KIN-TEST' or missing)
    if (inviteCode && inviteCode !== 'KIN-TEST') {
      const inviteStatus = await checkInviteCode(inviteCode);
      if (!inviteStatus.valid) {
        return res.status(400).json({ error: inviteStatus.message });
      }
    }

    // 2. Handle Logic & Duplication Check
    let finalHandle = requestedHandle || `Parent_${Math.floor(1000 + Math.random() * 9000)}`;
    
    const existingParent = await Parent.findOne({ handle: finalHandle });
    if (existingParent) {
      return res.status(400).json({ error: "Handle already taken." });
    }

    // 3. 8-Digit Key Validation
    if (!/^\d{8}$/.test(finalRecoveryKey)) {
      return res.status(400).json({ error: "Recovery key must be exactly 8 digits." });
    }

    // 4. Create Parent Record (Matches the separate Parent model)
    const newParent = await Parent.create({
      handle: finalHandle,
      email: email, 
      passwordHash: password,
      recoveryKeyHash: finalRecoveryKey,
      inviteCodeUsed: inviteCode,
      meritScore: 5
    });

    // Only mark it used if it was a real code
    if (inviteCode && inviteCode !== 'KIN-TEST') {
      await markInviteCodeUsed(inviteCode, finalHandle);
    }

    // Sync to Supabase
    try {
      await syncService.syncUserToSupabase(newParent);
    } catch (syncError) {
      console.error('⚠️  Initial Supabase sync failed for parent:', syncError.message);
      // We don't fail registration if sync fails, but we log it
    }

    res.status(201).json({ 
      success: true, 
      handle: finalHandle,
      recoveryKey: finalRecoveryKey,
      message: "Registration successful. Welcome, Angel!" 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- CHILD REGISTRATION LOGIC ---
exports.registerChild = async (req, res) => {
  try {
    const { inviteCode, username, email, password, ageGroup, eightDigitKey } = req.body;

    // Generate random 8-digit key if not provided
    const finalRecoveryKey = eightDigitKey || Math.floor(10000000 + Math.random() * 90000000).toString();


    // 1. Check Invite Code
    const inviteStatus = await checkInviteCode(inviteCode);
    if (!inviteStatus.valid) {
      return res.status(400).json({ error: inviteStatus.message });
    }

    // 2. Duplication Check
    const existingUser = await User.findOne({ $or: [{ handle: username }, { email: email }] });
    if (existingUser) {
      return res.status(400).json({ error: "Username or Email already taken." });
    }

    // We get the parent ID from the invite logic wait... checkInviteCode gives the invite object!
    // But parentId relies on the invite being created correctly. If the invite doesn't store parent ObjectID natively, we find the parent by the handle?
    // Let's just create the child
    const newChild = await User.create({
      role: 'child',
      handle: username,
      email: email,
      passwordHash: password, 
      recoveryKeyHash: finalRecoveryKey,
      inviteCodeUsed: inviteCode,
      meritScore: 5,
      ageGroup: ageGroup || '12-16',
    });

    // Mark the invite code as used
    await markInviteCodeUsed(inviteCode, username);

    // Sync to Supabase
    try {
      await syncService.syncUserToSupabase(newChild);
    } catch (syncError) {
      console.error('⚠️ Supabase sync failed for child:', syncError.message);
    }

    res.status(201).json({ 
      success: true, 
      handle: username,
      recoveryKey: finalRecoveryKey,
      message: "Child Registration successful." 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- LOGIN LOGIC ---
exports.loginUser = async (req, res) => {
  try {
    const { handle, email, password } = req.body;
    
    // Fallback if UI sends email instead of handle
    const searchIdentifier = email || handle;

    // Check both collections using $or
    const searchQuery = { $or: [{ handle: searchIdentifier }, { email: searchIdentifier }] };
    const user = await User.findOne(searchQuery) || await Parent.findOne(searchQuery);

    if (!user) {
        return res.status(401).json({ error: "Invalid handle or password" });
    }

    // Check password (Standardized naming)
    const isMatch = await user.matchPassword(password);

    if (isMatch) {
      const token = jwt.sign(
        { id: user._id, role: user.role || 'parent' },
        process.env.JWT_SECRET, 
        { expiresIn: '30d' }
      );

      // Trigger background sync to keep Supabase up to date
      syncService.syncUserToSupabase(user).catch(err => {
        console.error('⚠️  Background Supabase sync failed during login:', err.message);
      });

      res.json({ 
        token, 
        handle: user.handle, 
        meritScore: user.meritScore,
        role: user.role || 'parent'
      });
    } else {
      res.status(401).json({ error: "Invalid handle or password" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- DELETE ACCOUNT LOGIC ---
exports.deleteAccount = async (req, res) => {
  try {
    const { handle, eightDigitKey } = req.body;

    const user = await User.findOne({ handle }) || await Parent.findOne({ handle });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const isMatch = await user.matchRecoveryKey(eightDigitKey);
    
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid recovery key. Deletion denied." });
    }

    if (user.role === 'parent' || !user.role) {
        await Parent.findByIdAndDelete(user._id);
    } else {
        await User.findByIdAndDelete(user._id);
    }

    res.json({ 
      success: true, 
      message: "Account permanently deleted. Farewell!" 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};