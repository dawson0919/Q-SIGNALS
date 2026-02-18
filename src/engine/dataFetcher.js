// Data Fetcher — ensures fresh data up to now for backtesting
// Reads from Supabase DB, detects gaps, fills from Binance API
const { getCandles, insertCandles, getLatestCandleTime } = require('../data/database');
const { fetchKlines } = require('../data/backfill');

const BACKTEST_DAYS = 180; // only use the last 180 days

// In-memory candle cache: prevents duplicate CoinGecko hits from concurrent backtest requests
// Key: "symbol_timeframe", Value: { candles, fetchedAt }
const candleCache = {};
const CANDLE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Fetch lock: prevents multiple simultaneous CoinGecko/Binance fetches for the same symbol+timeframe
// Key: "symbol_timeframe", Value: Promise
const activeFetches = {};

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

    // Step 2: Check for staleness
    const intervalMs = (timeframe === '4h' ? 4 : 1) * 60 * 60 * 1000;
    // Allow 2 intervals of latency before triggering fetch
    const staleThreshold = now - (intervalMs * 2);

    let lastCandleTime = 0;
    if (candles.length > 0) {
        const last = candles[candles.length - 1];
        lastCandleTime = last.open_time || last.openTime;
    }

    // Step 3: Fetch fresh data if stale or empty
    if (candles.length === 0 || lastCandleTime < staleThreshold) {
        const lockKey = `${symbol}_${timeframe}`;

        // Check in-memory cache first (avoids DB round-trip + CG rate-limit burst)
        const cached = candleCache[lockKey];
        if (cached && (now - cached.fetchedAt) < CANDLE_CACHE_TTL_MS) {
            console.log(`[DataFetcher] Using in-memory cache for ${symbol} @ ${timeframe} (age: ${Math.round((now - cached.fetchedAt) / 1000)}s)`);
            candles = cached.candles;
        } else {
            // If a fetch is already in-flight for this symbol/timeframe, wait for it
            // instead of firing a duplicate external request (prevents CG 429 bursts)
            if (!activeFetches[lockKey]) {
                const fetchStart = lastCandleTime ? lastCandleTime + intervalMs : startTime;
                activeFetches[lockKey] = (async () => {
                    try {
                        const freshCandles = await fetchKlines(symbol, timeframe, fetchStart, now);
                        if (freshCandles.length > 0) {
                            console.log(`[DataFetcher] Fetched ${freshCandles.length} fresh candles for ${symbol}.`);
                            await insertCandles(symbol, timeframe, freshCandles);
                        }
                        return freshCandles;
                    } catch (err) {
                        console.error(`[DataFetcher] Failed to fetch ${symbol}:`, err.message);
                        return [];
                    }
                })().finally(() => {
                    delete activeFetches[lockKey];
                });
            } else {
                console.log(`[DataFetcher] Waiting for in-flight fetch for ${symbol} @ ${timeframe}...`);
            }

            const freshCandles = await activeFetches[lockKey];

            if (freshCandles && freshCandles.length > 0) {
                candles = [...candles, ...freshCandles];
            } else if (freshCandles && freshCandles.length === 0 && candles.length === 0) {
                // Fetch returned nothing — re-read DB in case a concurrent request already saved data
                candles = await getCandles(symbol, timeframe, startTime, endTime);
            }

            // Update in-memory cache
            if (candles.length > 0) {
                candleCache[lockKey] = { candles: [...candles], fetchedAt: now };
            }
        }
    }

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

    // Step 5: Trim to window
    candles = candles.filter(c => (c.open_time || c.openTime) >= startTime);

    console.log(`[DataFetcher] Returning ${candles.length} candles for ${symbol}`);
    if (candles.length > 0) {
        const first = candles[0].open_time || candles[0].openTime;
        const last = candles[candles.length - 1].open_time || candles[candles.length - 1].openTime;
        console.log(`[DataFetcher] Range: ${new Date(first).toISOString().slice(0, 16)} → ${new Date(last).toISOString().slice(0, 16)}`);
    }

    return candles;
}

module.exports = { getCandleData };
