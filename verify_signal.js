
const Backtester = require('./src/engine/backtester');
const { getCandleData } = require('./src/engine/dataFetcher');
const { initSupabase } = require('./src/data/database');
const strategies = require('./src/engine/strategies/macdMa'); // Test with macdMa

async function test() {
    initSupabase(); // Initialize DB connection

    console.log('Fetching 365 days of candles for BTCUSDT...');
    // Mocking 'BTCUSDT' and 365 days
    // Note: getCandleData assumes DB is populated. Backfill already ran on server start.
    const candles = await getCandleData('BTCUSDT', '4h', 365);
    console.log(`Candles: ${candles.length}`);

    if (candles.length === 0) {
        console.log('No candles found! DB might be empty or connection failed.');
        return;
    }

    const backtester = new Backtester();
    const strategyFn = strategies.execute; // ma60 is simple

    const report = backtester.run(strategyFn, candles);
    console.log('Stats:', report.summary);

    if (report.recentTrades.length > 0) {
        console.log('Latest Trade:', report.recentTrades[0]);
    } else {
        console.log('No trades found in recent history.');
    }
}

test().catch(console.error);
