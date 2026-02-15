// Historical Data Backfill from Binance REST API
const { insertCandles, getLatestCandleTime, getCandleCount } = require('./database');

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XAUUSDT', 'SPXUSDT'];
const TIMEFRAMES = ['1h', '4h'];
const BACKFILL_DAYS = parseInt(process.env.BACKFILL_DAYS || '365');
const BINANCE_SPOT_API = 'https://api.binance.com/api/v3/klines';
const BINANCE_FUTURES_API = 'https://fapi.binance.com/fapi/v1/klines';

async function fetchKlines(symbol, interval, startTime, endTime, limit = 1000) {
    const isFutures = symbol === 'XAUUSDT' || symbol === 'SPXUSDT';
    const baseUrl = isFutures ? BINANCE_FUTURES_API : BINANCE_SPOT_API;

    const params = new URLSearchParams({
        symbol,
        interval,
        limit: String(limit),
    });
    if (startTime) params.append('startTime', String(startTime));
    if (endTime) params.append('endTime', String(endTime));

    const url = `${baseUrl}?${params.toString()}`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Binance API error: ${res.status} ${res.statusText}`);
        }
        const data = await res.json();

        return data.map(k => ({
            openTime: k[0],
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
            closeTime: k[6],
        }));
    } catch (err) {
        console.error(`[Backfill] Failed to fetch ${symbol}:`, err.message);
        return [];
    }
}

// Backfill a single symbol with pagination
async function backfillSymbol(symbol, timeframe) {
    const latestTime = await getLatestCandleTime(symbol, timeframe);
    const now = Date.now();
    let startTime;

    if (latestTime) {
        // Incremental: start from last known candle
        startTime = latestTime + 1;
        console.log(`[Backfill] ${symbol}: Incremental from ${new Date(startTime).toISOString()}`);
    } else {
        // Full backfill
        startTime = now - (BACKFILL_DAYS * 24 * 60 * 60 * 1000);
        console.log(`[Backfill] ${symbol}: Full backfill (${BACKFILL_DAYS} days)`);
    }

    let totalInserted = 0;
    let currentStart = startTime;

    while (currentStart < now) {
        const candles = await fetchKlines(symbol, timeframe, currentStart, now, 1000);

        if (candles.length === 0) break;

        const count = await insertCandles(symbol, timeframe, candles);
        totalInserted += count;

        // Move to next batch
        const lastCandle = candles[candles.length - 1];
        currentStart = lastCandle.closeTime + 1;

        // Rate limiting
        await new Promise(r => setTimeout(r, 200));
    }

    const totalCount = await getCandleCount(symbol, timeframe);
    console.log(`[Backfill] ${symbol} (${timeframe}): Inserted ${totalInserted} candles (total in DB: ${totalCount})`);
    return totalInserted;
}

async function backfillAllSymbols() {
    for (const timeframe of TIMEFRAMES) {
        for (const symbol of SYMBOLS) {
            try {
                await backfillSymbol(symbol, timeframe);
            } catch (err) {
                console.error(`[Backfill] Error for ${symbol} (${timeframe}):`, err.message);
            }
        }
    }
}

// Scheduled sync - run every 4 hours
function startScheduledSync() {
    const FOUR_HOURS = 4 * 60 * 60 * 1000;
    setInterval(async () => {
        console.log('[Sync] Running scheduled data sync...');
        await backfillAllSymbols();
        console.log('[Sync] Scheduled sync complete');
    }, FOUR_HOURS);
}

module.exports = {
    backfillAllSymbols,
    backfillSymbol,
    startScheduledSync,
    fetchKlines,
    SYMBOLS,
    TIMEFRAMES
};
