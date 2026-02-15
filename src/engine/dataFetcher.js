// Data Fetcher — ensures fresh data up to now for backtesting
// Reads from Supabase DB, detects gaps, fills from Binance API
const { getCandles, insertCandles, getLatestCandleTime } = require('../data/database');
const { fetchKlines } = require('../data/backfill');

const BACKTEST_DAYS = 180; // only use the last 180 days

/**
 * Get candle data for backtesting.
 * 1) Calculate 180-day window
 * 2) Query DB for that window
 * 3) If DB data doesn't reach today, fetch gap from Binance & store
 * 4) Return combined, sorted, deduplicated candles
 */
async function getCandleData(symbol, timeframe = '4h', daysBack = BACKTEST_DAYS) {
    const now = Date.now();
    const startTime = now - daysBack * 24 * 60 * 60 * 1000;

    // Step 1: Get data from DB within the 180-day window
    let candles = await getCandles(symbol, timeframe, startTime, now);
    console.log(`[DataFetcher] DB has ${candles.length} candles for ${symbol} (last ${daysBack} days)`);

    // Step 2: Check if data needs fetching (DISABLED for backtests as per request)
    /*
    const STALE_THRESHOLD = 8 * 60 * 60 * 1000; 
    let needsFetch = false;
    // ... logic ...
    */

    // Step 4: Deduplicate and sort (from DB data)
    const seen = new Set();
    candles = candles
        .filter(c => {
            if (seen.has(c.open_time)) return false;
            seen.add(c.open_time);
            return true;
        })
        .sort((a, b) => a.open_time - b.open_time);

    // Step 5: Trim to window
    candles = candles.filter(c => c.open_time >= startTime);

    console.log(`[DataFetcher] Returning ${candles.length} candles for ${symbol} (DB ONLY)`);
    if (candles.length > 0) {
        console.log(`[DataFetcher] Range: ${new Date(candles[0].open_time).toISOString().slice(0, 10)} → ${new Date(candles[candles.length - 1].open_time).toISOString().slice(0, 10)}`);
    }

    return candles;
}

module.exports = { getCandleData };
