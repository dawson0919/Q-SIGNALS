
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixConstraints() {
    console.log('--- Fixing Database Constraints ---');

    const sql = `
        -- Drop old unique index if it exists
        DROP INDEX IF EXISTS subscriptions_user_id_strategy_id_idx;
        ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_strategy_id_key;
        ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_unique_sub;

        -- Add columns if they are missing
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscriptions' AND column_name='symbol') THEN
                ALTER TABLE public.subscriptions ADD COLUMN symbol TEXT DEFAULT 'BTCUSDT';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscriptions' AND column_name='timeframe') THEN
                ALTER TABLE public.subscriptions ADD COLUMN timeframe TEXT DEFAULT '4h';
            END IF;
        END $$;

        -- Create the new unique constraint
        ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_unique_sub UNIQUE(user_id, strategy_id, symbol, timeframe);
    `;

    // We use the REST API to execute SQL via the 'postgres' RPC if available, 
    // but since we don't have it, we'll try to use a dummy migration or just direct query if possible.
    // Actually, on Supabase, the best way to do this without an RPC is via the Dashboard.
    // But I will try to see if I can use the 'apply_migration' tool again with a fresh connection.
    console.log('Attempting via RPC...');
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.log('RPC exec_sql not found or failed. Trying a different method...');
        // If RPC fails, I'll recommend the user to run it in the SQL editor.
        console.log('Please run the following SQL in your Supabase SQL Editor:');
        console.log(sql);
    } else {
        console.log('Successfully updated constraints!');
    }
}

fixConstraints();
