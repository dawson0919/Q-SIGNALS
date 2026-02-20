
const dotenv = require('dotenv');
dotenv.config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    try {
        console.log('Fetching all manual signals...');
        const { data, error } = await supabase
            .from('manual_signals')
            .select('*');

        if (error) {
            console.error('Error fetching data:', error);
            return;
        }

        if (!data) {
            console.log('No data returned.');
            return;
        }

        console.log('Total signals in DB:', data.length);
        const closed = data.filter(s => s.status === 'closed');
        const active = data.filter(s => s.status === 'active');

        console.log('Active:', active.length);
        console.log('Closed:', closed.length);

        let total = 0;
        closed.forEach(s => {
            console.log(`Signal ${s.id}: Symbol=${s.symbol}, ROI=${s.roi}, ClosedAt=${s.closed_at}`);
            total += parseFloat(s.roi || 0);
        });
        console.log('Grand Total ROI sum:', total);
    } catch (e) {
        console.error('An unexpected error occurred:', e);
    }
}
check();
