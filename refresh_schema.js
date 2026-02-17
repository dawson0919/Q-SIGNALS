const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function refreshCache() {
    console.log('--- PostgREST Schema Cache Refresh ---');
    try {
        // Method 1: Execute a raw SQL that PostgREST might catch
        console.log('Adding/Ensuring column via direct SQL...');
        const { error: sqlError } = await supabase.rpc('execute_sql', {
            sql_query: 'ALTER TABLE public.premium_applications ADD COLUMN IF NOT EXISTS proof_urls TEXT[];'
        });

        if (sqlError) {
            console.warn('RPC execute_sql failed, this is common if rpc is not set up:', sqlError.message);
        }

        // Method 2: NOTIFY pgrst (if enabled, this is the standard way to refresh)
        console.log('Sending NOTIFY pgrst, reload_schema...');
        await supabase.rpc('execute_sql', {
            sql_query: 'NOTIFY pgrst, \'reload schema\';'
        }).catch(e => console.log('Notify failed (ignoring)'));

        console.log('Attempting to "touch" the table to trigger discovery...');
        const { data, error } = await supabase.from('premium_applications').select('id').limit(1);
        if (error) console.error('Touch Error:', error);
        else console.log('Touch Success. Current Schema Cache should ideally update.');

    } catch (e) {
        console.error('Refresh logic failed:', e);
    }
}

refreshCache();
