require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

/**
 * Supabase Client Initialization
 * Uses the Service Role Key to bypass RLS for backend synchronization tasks.
 */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase configuration missing! Check your .env file.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

module.exports = supabase;
