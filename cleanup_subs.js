const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanDuplicates() {
    const userId = 'c337aaf8-b161-4d96-a6f4-35597dbdc4dd'; // Admin User ID from logs
    console.log(`Checking subscriptions for user: ${userId}`);

    const { data: subs, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching:', error);
        return;
    }

    console.log(`Found ${subs.length} subscriptions.`);

    // Group by signature to find duplicates
    const seen = new Set();
    const duplicates = [];

    for (const sub of subs) {
        const key = `${sub.strategy_id}-${sub.symbol}-${sub.timeframe}`;
        if (seen.has(key)) {
            duplicates.push(sub.id);
        } else {
            seen.add(key);
            console.log(`Keep: ${key} (ID: ${sub.id})`);
        }
    }

    console.log(`Found ${duplicates.length} duplicates to delete.`);

    if (duplicates.length > 0) {
        const { error: delError } = await supabase
            .from('subscriptions')
            .delete()
            .in('id', duplicates);

        if (delError) console.error('Delete error:', delError);
        else console.log('Duplicates deleted successfully.');
    }
}

cleanDuplicates();
