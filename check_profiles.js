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

async function checkProfiles() {
    const { data, error } = await supabase
        .from('profiles')
        .select('email, role')
        .in('email', emails);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Current Profiles:', JSON.stringify(data, null, 2));
    }
}

checkProfiles();
