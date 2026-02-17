require('dotenv').config();
const https = require('https');

const PROJECT_REF = 'zrhussirvsgsoffmrkxb';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sql = `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_username TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_chat_id ON profiles (telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;`;

const postData = JSON.stringify({ query: sql });

const options = {
    hostname: `${PROJECT_REF}.supabase.co`,
    path: '/rest/v1/rpc/',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
    }
};

// Direct SQL via pg_net or similar won't work via REST.
// Let's try the database.sql endpoint instead (Supabase Edge)
// Actually, the simplest method: use @supabase/supabase-js with .rpc()
// But we need a postgres function.

// Alternative: Execute via the Supabase PostgREST endpoint with a raw SQL function
// Since exec_sql doesn't exist, let's create columns by attempting raw HTTP to the Management API

const { createClient } = require('@supabase/supabase-js');

async function run() {
    const supabase = createClient(
        process.env.SUPABASE_URL,
        SERVICE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false }, db: { schema: 'public' } }
    );

    // Method: Try to use the columns. If they don't exist, we need to add them via SQL Editor.
    // Since we can't run DDL via PostgREST, let's try another approach:
    // Update a profile with the new fields - if the column doesn't exist, it'll error.

    const testUpdate = await supabase
        .from('profiles')
        .update({ telegram_chat_id: 'test' })
        .eq('id', '00000000-0000-0000-0000-000000000000');

    if (testUpdate.error) {
        if (testUpdate.error.message.includes('telegram_chat_id')) {
            console.log('COLUMNS DO NOT EXIST. Running migration via SQL function...');

            // Create a temporary function to run the DDL
            // This won't work via PostgREST either. 
            // Best approach: output the SQL for the user to run.
            console.log('');
            console.log('=== PLEASE RUN THIS SQL IN SUPABASE DASHBOARD ===');
            console.log('Go to: https://supabase.com/dashboard/project/zrhussirvsgsoffmrkxb/sql/new');
            console.log('');
            console.log(sql);
            console.log('');
            console.log('=================================================');
        } else {
            // Row not found = columns exist, just no matching row
            console.log('Columns exist! (no matching row, which is expected)');
        }
    } else {
        console.log('Columns exist and update succeeded!');
    }
}

run().catch(console.error);
