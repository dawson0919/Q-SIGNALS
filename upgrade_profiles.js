const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const emails = [
    'kr23999@gmail.com',
    'denis79911@hotmail.com',
    'Info@sodabloom.com',
    'vincent30456@gmail.com',
    'harumi.lee0071@gmail.com'
];

async function upgradeProfiles() {
    const { data, error } = await supabase
        .from('profiles')
        .update({ role: 'advanced' })
        .in('email', emails)
        .select();

    if (error) {
        console.error('Error updating profiles:', error);
    } else {
        console.log('Successfully upgraded profiles:', data.map(p => p.email));

        // Check for missing emails
        const foundEmails = data.map(p => p.email.toLowerCase());
        const missing = emails.filter(e => !foundEmails.includes(e.toLowerCase()));
        if (missing.length > 0) {
            console.log('Note: The following emails were not found in the database (they may need to log in first):', missing);
        }
    }
}

upgradeProfiles();
