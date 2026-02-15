const { getSupabase } = require('./src/data/database');
const crypto = require('crypto');

async function createTestData() {
    const supabase = getSupabase();
    console.log('🔄 Creating Test Accounts...');

    const testUsers = [
        { email: 'trader.alex@test.com', account: 'MT-882145' },
        { email: 'crypto.sarah@test.com', account: 'MT-993214' },
        { email: 'investor.mike@test.com', account: 'PX-774412' }
    ];

    for (const u of testUsers) {
        // 1. Generate fake UUID for profile (Note: This bypasses auth.users, strictly for testing UI)
        // If your DB has strict FK to auth.users, this might fail unless disabled.
        const id = crypto.randomUUID();

        // Check if user exists (by email) in profiles to avoid dupes if re-run
        const { data: existing } = await supabase.from('profiles').select('id').eq('email', u.email).single();

        let userId = existing ? existing.id : id;

        if (!existing) {
            console.log(`Creating profile for ${u.email}...`);
            const { error: pError } = await supabase.from('profiles').insert({
                id: userId,
                email: u.email,
                role: 'standard'
            });

            if (pError) {
                console.error(`Failed to create profile for ${u.email}:`, pError.message);
                continue;
            }
        }

        // 2. Create Application
        console.log(`Creating Application for ${u.email} (Account: ${u.account})...`);
        const { error: aError } = await supabase.from('premium_applications').insert({
            user_id: userId,
            email: u.email,
            trading_account: u.account,
            status: 'pending'
        });

        if (aError) {
            console.error(`Failed to create application for ${u.email}:`, aError.message);
        } else {
            console.log(`✅ Application created for ${u.email}`);
        }
    }
}

createTestData().then(() => console.log('Done!'));
