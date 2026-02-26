require('dotenv').config();
const { backfillSymbol } = require('./src/data/backfill');
const { testConnection } = require('./src/data/database');

async function syncPAXG() {
    console.log('Connecting to Supabase...');
    const conn = await testConnection();
    if (!conn.success) {
        console.error('Connection failed:', conn.message);
        process.exit(1);
    }
    console.log('Connection OK. Current candle count:', conn.count);

    const timeframes = ['1h', '4h'];
    const symbol = 'PAXGUSDT';

    for (const tf of timeframes) {
        console.log(`\n--- Syncing ${symbol} ${tf} ---`);
        try {
            const count = await backfillSymbol(symbol, tf);
            console.log(`Successfully synced ${symbol} ${tf}. Total inserted: ${count}`);
        } catch (err) {
            console.error(`Error syncing ${symbol} ${tf}:`, err.message);
        }
    }

    console.log('\nSync Complete!');
    process.exit(0);
}

syncPAXG();
