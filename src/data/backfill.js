// Historical Data Backfill from Binance REST API
const { insertCandles, getLatestCandleTime, getCandleCount } = require('./database');

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XAUUSDT', 'SPXUSDT', 'NASUSDT'];
const CG_ID_MAP = {
    'SPXUSDT': 'spdr-s-p-500-etf-ondo-tokenized-etf', // or standard SPX if available
    'NASUSDT': 'invesco-qqq-etf-ondo-tokenized-etf',
    'XAUUSDT': 'tether-gold' // Use XAUT as proxy for Gold to bypass Binance limits
};
const TIMEFRAMES = ['1h', '4h'];
const BACKFILL_DAYS = parseInt(process.env.BACKFILL_DAYS || '365');
const BINANCE_SPOT_API = 'https://api.binance.com/api/v3/klines';
const BINANCE_FUTURES_API = 'https://fapi.binance.com/fapi/v1/klines';

async function fetchKlines(symbol, interval, startTime, endTime, limit = 1000) {
    // Route to CoinGecko for SPX/NAS
    if (CG_ID_MAP[symbol]) {
        // Calculate days from start/end or default back (e.g. 90)
        let days = 90;
        if (startTime) {
            const diff = Date.now() - startTime;
            days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        }
        return fetchKlinesFromCG(symbol, interval, days);
    }

    const isFutures = symbol === 'XAUUSDT';
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

async function fetchKlinesFromCG(symbol, interval, days) {
    const cgId = CG_ID_MAP[symbol];
    if (!cgId) return [];

    const baseUrl = `https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=usd&days=${days}`;

    console.log(`[Backfill] Fetching ${symbol} from CoinGecko (${days} days)...`);

    try {
        const res = await fetch(baseUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) throw new Error(`CG API error: ${res.status}`);
        const data = await res.json();

        if (!data.prices || data.prices.length === 0) return [];

        // CG returns [ts, price]. We need to convert/group into candles.
        const candles = [];
        const intervalMs = (interval === '4h' ? 4 : 1) * 60 * 60 * 1000;

        // Group points by interval
        const groups = {};
        for (const [ts, price] of data.prices) {
            // Data Sanitization: Ignore zero or invalid prices (common in some CG token feeds)
            if (!price || price < 1) continue;

            const bucket = Math.floor(ts / intervalMs) * intervalMs;
            if (!groups[bucket]) groups[bucket] = [];
            groups[bucket].push(price);
        }

        const sortedBuckets = Object.keys(groups).sort((a, b) => parseInt(a) - parseInt(b));

        for (const bucketStr of sortedBuckets) {
            const bucket = parseInt(bucketStr);
            const prices = groups[bucket];
            candles.push({
                openTime: bucket,
                open: prices[0],
                high: Math.max(...prices),
                low: Math.min(...prices),
                close: prices[prices.length - 1],
                volume: 0,
                closeTime: bucket + intervalMs - 1
            });
        }

        return candles;
    } catch (err) {
        console.error(`[Backfill] CG Failed for ${symbol}:`, err.message);
        return [];
    }
}

// Backfill a single symbol with pagination
async function backfillSymbol(symbol, timeframe) {
    const isCG = !!CG_ID_MAP[symbol];
    const latestTime = await getLatestCandleTime(symbol, timeframe);
    const now = Date.now();
    let startTime;

    if (isCG) {
        // CoinGecko historical data handling
        // CG gives hourly for 90d, daily for the rest.
        // We'll fetch 90d to ensure good 1h/4h resolution.
        const days = 90;
        const candles = await fetchKlinesFromCG(symbol, timeframe, days);
        if (candles.length > 0) {
            const count = await insertCandles(symbol, timeframe, candles);
            console.log(`[Backfill] ${symbol} (${timeframe}): Inserted ${count} candles from CoinGecko`);
        }
        return;
    }

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
