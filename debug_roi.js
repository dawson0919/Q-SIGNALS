
const { getAdminClient } = require('./src/data/database');
require('dotenv').config();

async function check() {
    try {
        const { data, error } = await getAdminClient()
            .from('manual_signals')
            .select('status, roi')
            .eq('status', 'closed');

        if (error) {
            console.error('Error:', error);
            return;
        }

        console.log('Closed signals found:', data.length);
        let total = 0;
        data.forEach(s => {
            console.log('ROI:', s.roi);
            total += parseFloat(s.roi || 0);
        });
        console.log('Total ROI:', total);
    } catch (e) {
        console.error('Catch:', e);
    }
}
check();
