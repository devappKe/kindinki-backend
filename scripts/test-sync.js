const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Parent = require('../models/Parent');
const MeritLog = require('../models/MeritLog');
const syncService = require('../services/syncService');

const runTest = async () => {
  try {
    console.log('🚀 Starting Sync Verification Test...');
    
    // 1. Connect to MongoDB
    await connectDB();
    
    // 2. Create/Find a Test Parent
    console.log('\n--- Testing Parent Sync ---');
    let testParent = await Parent.findOne({ handle: 'Test_Parent_001' });
    if (!testParent) {
      testParent = new Parent({
        handle: 'Test_Parent_001',
        email: 'test_parent@kindinki.test',
        password: 'password123',
        recoveryKey: '12345678',
        inviteCodeUsed: 'TEST_INVITE'
      });
      await testParent.save();
    }
    
    console.log('Syncing Parent to Supabase...');
    const parentSync = await syncService.syncUserToSupabase(testParent);
    console.log('✅ Parent Synced:', parentSync.id);
    
    // 3. Create/Find a Test Child
    console.log('\n--- Testing Child (User) Sync ---');
    let testChild = await User.findOne({ handle: 'Test_Child_001' });
    if (!testChild) {
      testChild = new User({
        role: 'child',
        handle: 'Test_Child_001',
        passwordHash: 'password123',
        inviteCodeUsed: 'TEST_INVITE',
        recoveryKeyHash: '12345678',
        meritScore: 5,
        ageGroup: '12-16',
        parentId: testParent._id,
        supabaseParentId: testParent.supabaseId
      });
      await testChild.save();
    }
    
    console.log('Syncing Child to Supabase...');
    const childSync = await syncService.syncUserToSupabase(testChild);
    console.log('✅ Child Synced:', childSync.id);
    
    // 4. Test Merit Log Sync
    console.log('\n--- Testing Merit Log Sync ---');
    const testLog = new MeritLog({
      userId: testChild._id,
      supabaseUserId: testChild.supabaseId || childSync.auth_id || childSync.id,
      previousScore: 5,
      newScore: 7,
      scoreChange: 2,
      changeReason: 'Test sync verification',
      avatarType: 'angel',
      avatarLevel: 3,
      supabaseParentId: testParent.supabaseId
    });
    await testLog.save();
    
    console.log('Syncing Merit Log to Supabase...');
    const logSync = await syncService.syncMeritLogToSupabase(testLog);
    console.log('✅ Merit Log Synced:', logSync.id);
    
    console.log('\n✨ All tests completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
};

runTest();
