require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function runMigration() {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        console.error('Missing environment variables');
        return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const sqlPath = path.join(__dirname, 'src', 'migrations', 'manual_signals.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying migration to create manual_signals table...');

    // Check if table exists
    const { data: tableExists, error: checkError } = await supabase
        .from('manual_signals')
        .select('id')
        .limit(1);

    if (!checkError) {
        console.log('Table manual_signals already exists.');
        return;
    }

    // Since Supabase JS doesn't support raw SQL execution directly,
    // and we don't have an RPC function for it, we'll try to use a direct 
    // PostgreSQL client if we had the connection string.
    // However, for this environment, the best way is for the user to copy-paste the SQL 
    // into the Supabase SQL Editor.

    console.log('\n--- IMPORTANT ACTION REQUIRED ---');
    console.log('The Supabase MCP server is currently unavailable.');
    console.log('Please copy the content of:');
    console.log('  ' + sqlPath);
    console.log('\nAnd paste it into the Supabase SQL Editor here:');
    console.log('  https://supabase.com/dashboard/project/zrhussirvsgsoffmrkxb/sql/new');
    console.log('----------------------------------\n');
}

runMigration();
