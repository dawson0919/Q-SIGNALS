// Data Fetcher — ensures fresh data up to now for backtesting
// Reads from Supabase DB, detects gaps, fills from Binance API
const { getCandles, insertCandles, getLatestCandleTime } = require('../data/database');
const { fetchKlines } = require('../data/backfill');

const BACKTEST_DAYS = 180; // only use the last 180 days

/**
 * Get candle data for backtesting.
 * @param {string} symbol
 * @param {string} timeframe
 * @param {number|object} options - either daysBack (number) or { startTime, endTime }
 */
async function getCandleData(symbol, timeframe = '4h', options = {}) {
    const now = Date.now();
    let startTime, endTime;

    if (typeof options === 'number') {
        startTime = now - options * 24 * 60 * 60 * 1000;
        endTime = now;
    } else {
        endTime = options.endTime || now;
        if (options.startTime) {
            startTime = options.startTime;
        } else {
            const daysBack = options.daysBack || BACKTEST_DAYS;
            startTime = endTime - daysBack * 24 * 60 * 60 * 1000;
        }
    }

    // Step 1: Get data from DB within the window
    let candles = await getCandles(symbol, timeframe, startTime, endTime);
    console.log(`[DataFetcher] DB has ${candles.length} candles for ${symbol} @ ${timeframe}`);

    // Step 4: Deduplicate and sort
    const seen = new Set();
    candles = candles
        .filter(c => {
            const t = c.open_time || c.openTime;
            if (seen.has(t)) return false;
            seen.add(t);
            return true;
        })
        .sort((a, b) => (a.open_time || a.openTime) - (b.open_time || b.openTime));

    // Step 5: Trim to window (redundant but safe)
    candles = candles.filter(c => (c.open_time || c.openTime) >= startTime);

    console.log(`[DataFetcher] Returning ${candles.length} candles for ${symbol} (DB ONLY)`);
    if (candles.length > 0) {
        const first = candles[0].open_time || candles[0].openTime;
        const last = candles[candles.length - 1].open_time || candles[candles.length - 1].openTime;
        console.log(`[DataFetcher] Range: ${new Date(first).toISOString().slice(0, 16)} → ${new Date(last).toISOString().slice(0, 16)}`);
    }

    return candles;
}

module.exports = { getCandleData };
