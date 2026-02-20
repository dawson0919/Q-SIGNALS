
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    try {
        const { data, error } = await supabase
            .from('manual_signals')
            .select('*');

        if (error) {
            console.error('Error:', error);
            return;
        }

        console.log('Total signals in DB:', data.length);
        const closed = data.filter(s =\u003e s.status === 'closed');
        const active = data.filter(s =\u003e s.status === 'active');

        console.log('Active:', active.length);
        console.log('Closed:', closed.length);

        let total = 0;
        closed.forEach(s =\u003e {
            console.log(`Signal ${s.id}: Status=${s.status}, ROI=${s.roi}`);
            total += parseFloat(s.roi || 0);
    });
    console.log('Calc Total ROI:', total);
} catch (e) {
    console.error('Catch:', e);
}
}
check();
