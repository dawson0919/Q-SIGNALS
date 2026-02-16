require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    console.log('Inspecting subscriptions table structure...');
    const { data, error } = await supabase.from('subscriptions').select('*').limit(1);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Data sample:', data);
        if (data.length > 0) {
            console.log('Columns:', Object.keys(data[0]));
        } else {
            console.log('Table is empty, cannot infer columns from data.');
            // Try to insert a dummy to see error? No, safer to just assume.
        }
    }
}

inspect();
