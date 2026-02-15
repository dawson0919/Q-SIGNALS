// Historical Data Backfill from Binance REST API
const { insertCandles, getLatestCandleTime, getCandleCount } = require('./database');

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
const TIMEFRAME = '4h';
const BACKFILL_DAYS = parseInt(process.env.BACKFILL_DAYS || '365');
const BINANCE_API = 'https://api.binance.com/api/v3/klines';

// Fetch klines from Binance
async function fetchKlines(symbol, interval, startTime, endTime, limit = 1000) {
    const params = new URLSearchParams({
        symbol,
        interval,
        limit: String(limit),
    });
    if (startTime) params.append('startTime', String(startTime));
    if (endTime) params.append('endTime', String(endTime));

    const url = `${BINANCE_API}?${params.toString()}`;

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
async function backfillSymbol(symbol) {
    const latestTime = await getLatestCandleTime(symbol, TIMEFRAME);
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
        const candles = await fetchKlines(symbol, TIMEFRAME, currentStart, now, 1000);

        if (candles.length === 0) break;

        const count = await insertCandles(symbol, TIMEFRAME, candles);
        totalInserted += count;

        // Move to next batch
        const lastCandle = candles[candles.length - 1];
        currentStart = lastCandle.closeTime + 1;

        // Rate limiting
        await new Promise(r => setTimeout(r, 200));
    }

    const totalCount = await getCandleCount(symbol, TIMEFRAME);
    console.log(`[Backfill] ${symbol}: Inserted ${totalInserted} candles (total in DB: ${totalCount})`);
    return totalInserted;
}

// Backfill all symbols
async function backfillAllSymbols() {
    for (const symbol of SYMBOLS) {
        try {
            await backfillSymbol(symbol);
        } catch (err) {
            console.error(`[Backfill] Error for ${symbol}:`, err.message);
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
    TIMEFRAME
};
