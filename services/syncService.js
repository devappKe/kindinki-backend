const supabase = require('../config/supabase');
const mongoose = require('mongoose');

/**
 * Sync Service
 * Handles one-way synchronization from MongoDB to Supabase.
 */

/**
 * Syncs a User (Child) or Parent to Supabase
 * @param {Object} doc - The Mongoose document (User or Parent)
 * @returns {Promise<Object>} - The Supabase sync result
 */
exports.syncUserToSupabase = async (doc) => {
  try {
    const isParent = doc.constructor.modelName === 'Parent' || doc.role === 'parent';
    const table = isParent ? 'parent_accounts' : 'user_profiles';
    
    let syncData = {};
    
    if (isParent) {
      syncData = {
        email: doc.email,
        parental_handle: doc.handle,
        updated_at: new Date()
      };
      
      // If we already have a supabaseId, use it for upsert
      if (doc.supabaseId) {
        syncData.id = doc.supabaseId;
      }
      
      // Note: auth_id should be linked if we use Supabase Auth, 
      // but here we are using MongoDB as primary auth for now.
      // We'll use a placeholder or the MongoDB ID as auth_id if needed, 
      // but the migration requires a UUID.
      if (!doc.supabaseId && !syncData.auth_id) {
        // Generate a UUID-like string if not provided (for RLS/Auth linking)
        syncData.auth_id = doc._id.toString(); // Use Mongo ID as a reliable seed for auth_id
      }
    } else {
      syncData = {
        username: doc.handle,
        email: `${doc.handle}@kindinki.local`, // Mock email if missing
        age_group: doc.ageGroup || '12-16',
        merit_score: doc.meritScore || 0,
        avatar_type: doc.meritScore >= 5 ? 'angel' : 'devil',
        avatar_level: Math.min(Math.floor((doc.meritScore || 0) / 2), 3),
        has_angel_tier: doc.hasAngelTier || false,
        is_storage_sharing_enabled: doc.isStorageSharingEnabled || false,
        updated_at: new Date()
      };
      
      if (doc.supabaseProfileId) {
        syncData.id = doc.supabaseProfileId;
      }
      
      if (doc.supabaseParentId) {
        syncData.parent_id = doc.supabaseParentId;
      }
    }

    const { data, error } = await supabase
      .from(table)
      .upsert(syncData, { onConflict: isParent ? 'parental_handle' : 'username' })
      .select()
      .single();

    if (error) throw error;

    // Update MongoDB with the Supabase IDs
    if (isParent) {
      doc.supabaseId = data.id;
    } else {
      doc.supabaseProfileId = data.id;
      if (data.auth_id) doc.supabaseId = data.auth_id;
    }
    
    doc.lastSyncedAt = new Date();
    await doc.save();

    return data;
  } catch (error) {
    console.error(`❌ Sync to Supabase failed:`, error.message);
    throw error;
  }
};

/**
 * Syncs a Merit Log to Supabase
 * @param {Object} log - The Mongoose MeritLog document
 * @returns {Promise<Object>}
 */
exports.syncMeritLogToSupabase = async (log) => {
  try {
    const syncData = {
      user_id: log.supabaseUserId,
      previous_score: log.previousScore,
      new_score: log.newScore,
      change_reason: log.changeReason,
      created_by: log.supabaseParentId,
      created_at: log.createdAt || new Date()
    };

    const { data, error } = await supabase
      .from('merit_logs')
      .insert(syncData)
      .select()
      .single();

    if (error) throw error;

    log.supabaseId = data.id;
    log.syncStatus = 'synced';
    log.lastSyncedAt = new Date();
    await log.save();

    return data;
  } catch (error) {
    console.error(`❌ Merit log sync failed:`, error.message);
    // Update status to failed in MongoDB
    log.syncStatus = 'failed';
    await log.save();
    throw error;
  }
};
