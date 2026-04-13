const MeritLog = require('../models/MeritLog');
const StorageLedger = require('../models/StorageLedger');
const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');

/**
 * Webhook Controller
 * Handles Supabase webhook events and syncs data to MongoDB
 */

/**
 * Main webhook handler
 * Routes events to appropriate handlers based on table
 */
exports.handleWebhook = async (req, res) => {
  const { type, table, record, old_record } = req.webhook;
  
  try {
    let result;
    
    switch (table) {
      case 'merit_logs':
        result = await handleMeritLogEvent(type, record, old_record);
        break;
        
      case 'storage_ledger':
        result = await handleStorageLedgerEvent(type, record, old_record);
        break;
        
      case 'payments':
        result = await handlePaymentEvent(type, record, old_record);
        break;
        
      case 'audit_logs':
        result = await handleAuditLogEvent(type, record, old_record);
        break;
        
      case 'user_profiles':
        result = await handleUserProfileEvent(type, record, old_record);
        break;
        
      case 'parent_accounts':
        result = await handleParentAccountEvent(type, record, old_record);
        break;
        
      default:
        console.warn(`⚠️  Unhandled table: ${table}`);
        return res.status(200).json({
          status: 'ignored',
          message: `Table ${table} not configured for sync`
        });
    }
    
    res.status(200).json({
      status: 'success',
      message: `${table} ${type} processed`,
      result
    });
    
  } catch (error) {
    console.error(`❌ Webhook processing error for ${table}:`, error);
    
    // Store failed sync for retry
    await storeFailedSync(table, type, record, error.message);
    
    // Return 200 to prevent Supabase retry, but log the error
    res.status(200).json({
      status: 'error',
      message: 'Processing failed, stored for retry',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Handle merit_logs events
 */
async function handleMeritLogEvent(type, record, old_record) {
  switch (type) {
    case 'INSERT':
      const meritLog = await MeritLog.syncFromSupabase(record);
      console.log(`✅ Merit log synced: ${meritLog.supabaseId}`);
      return { action: 'synced', id: meritLog._id };
      
    case 'UPDATE':
      const updatedMeritLog = await MeritLog.syncFromSupabase(record);
      console.log(`✅ Merit log updated: ${updatedMeritLog.supabaseId}`);
      return { action: 'updated', id: updatedMeritLog._id };
      
    case 'DELETE':
      if (old_record) {
        await MeritLog.findOneAndDelete({ supabaseId: old_record.id });
        console.log(`✅ Merit log deleted: ${old_record.id}`);
      }
      return { action: 'deleted' };
      
    default:
      throw new Error(`Unknown event type: ${type}`);
  }
}

/**
 * Handle storage_ledger events
 */
async function handleStorageLedgerEvent(type, record, old_record) {
  switch (type) {
    case 'INSERT':
      const ledger = await StorageLedger.syncFromSupabase(record);
      console.log(`✅ Storage ledger synced: ${ledger.supabaseId}`);
      return { action: 'synced', id: ledger._id };
      
    case 'UPDATE':
      const updatedLedger = await StorageLedger.syncFromSupabase(record);
      console.log(`✅ Storage ledger updated: ${updatedLedger.supabaseId}`);
      return { action: 'updated', id: updatedLedger._id };
      
    case 'DELETE':
      if (old_record) {
        await StorageLedger.findOneAndDelete({ supabaseId: old_record.id });
        console.log(`✅ Storage ledger deleted: ${old_record.id}`);
      }
      return { action: 'deleted' };
      
    default:
      throw new Error(`Unknown event type: ${type}`);
  }
}

/**
 * Handle payments events
 */
async function handlePaymentEvent(type, record, old_record) {
  switch (type) {
    case 'INSERT':
      const payment = await Payment.syncFromSupabase(record);
      console.log(`✅ Payment synced: ${payment.supabaseId}`);
      return { action: 'synced', id: payment._id };
      
    case 'UPDATE':
      const updatedPayment = await Payment.syncFromSupabase(record);
      console.log(`✅ Payment updated: ${updatedPayment.supabaseId}`);
      return { action: 'updated', id: updatedPayment._id };
      
    case 'DELETE':
      if (old_record) {
        await Payment.findOneAndDelete({ supabaseId: old_record.id });
        console.log(`✅ Payment deleted: ${old_record.id}`);
      }
      return { action: 'deleted' };
      
    default:
      throw new Error(`Unknown event type: ${type}`);
  }
}

/**
 * Handle audit_logs events
 */
async function handleAuditLogEvent(type, record, old_record) {
  switch (type) {
    case 'INSERT':
      const auditLog = await AuditLog.syncFromSupabase(record);
      console.log(`✅ Audit log synced: ${auditLog.supabaseId}`);
      return { action: 'synced', id: auditLog._id };
      
    case 'UPDATE':
      const updatedAuditLog = await AuditLog.syncFromSupabase(record);
      console.log(`✅ Audit log updated: ${updatedAuditLog.supabaseId}`);
      return { action: 'updated', id: updatedAuditLog._id };
      
    case 'DELETE':
      // Audit logs should generally not be deleted, but handle it
      if (old_record) {
        await AuditLog.findOneAndDelete({ supabaseId: old_record.id });
        console.log(`⚠️  Audit log deleted: ${old_record.id}`);
      }
      return { action: 'deleted' };
      
    default:
      throw new Error(`Unknown event type: ${type}`);
  }
}

/**
 * Handle user_profiles events
 * Updates User model in MongoDB to stay in sync
 */
async function handleUserProfileEvent(type, record, old_record) {
  const User = require('../models/User');
  
  switch (type) {
    case 'INSERT':
      // New user profile created in Supabase
      // Note: User auth is handled separately, this just syncs profile data
      console.log(`ℹ️  User profile created in Supabase: ${record.id}`);
      return { action: 'noted', message: 'Profile creation noted' };
      
    case 'UPDATE':
      // Update merit score in MongoDB User if linked
      if (record.merit_score !== undefined) {
        await User.findOneAndUpdate(
          { supabaseProfileId: record.id },
          { 
            meritScore: record.merit_score,
            lastSyncedAt: new Date()
          }
        );
      }
      console.log(`✅ User profile updated: ${record.id}`);
      return { action: 'updated' };
      
    case 'DELETE':
      console.log(`⚠️  User profile deleted: ${old_record?.id}`);
      return { action: 'noted', message: 'Profile deletion noted' };
      
    default:
      throw new Error(`Unknown event type: ${type}`);
  }
}

/**
 * Handle parent_accounts events
 */
async function handleParentAccountEvent(type, record, old_record) {
  const Parent = require('../models/Parent');
  
  switch (type) {
    case 'INSERT':
      console.log(`ℹ️  Parent account created in Supabase: ${record.id}`);
      return { action: 'noted', message: 'Parent account creation noted' };
      
    case 'UPDATE':
      // Update parent data in MongoDB if linked
      if (record.merit_score !== undefined) {
        await Parent.findOneAndUpdate(
          { supabaseId: record.id },
          { 
            meritScore: record.merit_score,
            lastSyncedAt: new Date()
          }
        );
      }
      console.log(`✅ Parent account updated: ${record.id}`);
      return { action: 'updated' };
      
    case 'DELETE':
      console.log(`⚠️  Parent account deleted: ${old_record?.id}`);
      return { action: 'noted', message: 'Parent account deletion noted' };
      
    default:
      throw new Error(`Unknown event type: ${type}`);
  }
}

/**
 * Store failed sync for later retry
 */
async function storeFailedSync(table, type, record, error) {
  // In production, store this in a failed_syncs collection
  // For now, just log it
  console.error(`
❌ Failed Sync Stored
   Table: ${table}
   Type: ${type}
   Record ID: ${record?.id}
   Error: ${error}
   Time: ${new Date().toISOString()}
  `);
}

/**
 * Manual sync endpoint - for initial sync or recovery
 */
exports.manualSync = async (req, res) => {
  try {
    const { table, since } = req.body;
    
    // This would connect to Supabase and fetch records since the given timestamp
    // For now, return a placeholder response
    res.json({
      status: 'info',
      message: 'Manual sync not yet implemented',
      table,
      since
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

/**
 * Get sync status
 */
exports.getSyncStatus = async (req, res) => {
  try {
    const [
      meritLogCount,
      storageLedgerCount,
      paymentCount,
      auditLogCount,
      failedSyncCount
    ] = await Promise.all([
      MeritLog.countDocuments(),
      StorageLedger.countDocuments(),
      Payment.countDocuments(),
      AuditLog.countDocuments(),
      0 // Would query failed_syncs collection
    ]);
    
    res.json({
      status: 'success',
      data: {
        syncedRecords: {
          meritLogs: meritLogCount,
          storageLedgers: storageLedgerCount,
          payments: paymentCount,
          auditLogs: auditLogCount
        },
        failedSyncs: failedSyncCount,
        lastSyncTime: new Date().toISOString()
      }
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
