const { getAdminClient } = require('./src/data/database');
require('dotenv').config();

async function dump() {
    try {
        const admin = getAdminClient();
        const { data, error } = await admin.from('manual_signals').select('*').order('created_at', { ascending: true });
        if (error) throw error;
        console.log(JSON.stringify(data, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
dump();
