// Real-time Price Monitor via Binance WebSocket
const WebSocket = require('ws');
const { insertCandles } = require('./database');

const SPOT_SYMBOLS = ['btcusdt', 'ethusdt', 'solusdt'];
const FUTURES_SYMBOLS = ['xauusdt', 'spxusdt'];
const ALL_SYMBOLS = [...SPOT_SYMBOLS, ...FUTURES_SYMBOLS];
const TIMEFRAMES = ['1h', '4h'];
const currentPrices = {};
let wsConnection = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000;

function getCurrentPrices() {
    return { ...currentPrices };
}

function startPriceMonitor() {
    const spotStreams = SPOT_SYMBOLS.map(s => [`${s}@kline_4h`, `${s}@kline_1h`, `${s}@ticker`]).flat().join('/');
    const futuresStreams = FUTURES_SYMBOLS.map(s => [`${s}@kline_4h`, `${s}@kline_1h`, `${s}@ticker`]).flat().join('/');

    const spotUrl = `wss://stream.binance.com:9443/stream?streams=${spotStreams}`;
    const futuresUrl = `wss://fstream.binance.com/stream?streams=${futuresStreams}`;

    function connect(url, isFutures) {
        console.log(`[PriceMonitor] Connecting to Binance ${isFutures ? 'Futures' : 'Spot'} WebSocket...`);
        let ws;
        try {
            ws = new WebSocket(url);
        } catch (err) {
            console.error(`[PriceMonitor] ${isFutures ? 'Futures' : 'Spot'} Connection error:`, err.message);
            setTimeout(() => connect(url, isFutures), 5000);
            return;
        }

        ws.on('open', () => {
            console.log(`[PriceMonitor] Connected to Binance ${isFutures ? 'Futures' : 'Spot'} WebSocket`);
        });

        ws.on('message', async (rawData) => {
            try {
                const msg = JSON.parse(rawData.toString());
                const data = msg.data;
                if (!data) return;

                const stream = msg.stream || '';

                // Ticker data - update current prices
                if (stream.includes('@ticker')) {
                    const symbol = data.s; // e.g. BTCUSDT
                    currentPrices[symbol] = {
                        price: parseFloat(data.c),
                        change24h: parseFloat(data.P),
                        high24h: parseFloat(data.h),
                        low24h: parseFloat(data.l),
                        volume24h: parseFloat(data.v),
                        timestamp: Date.now()
                    };

                    // Broadcast to frontend clients
                    if (global.broadcastPrices) {
                        global.broadcastPrices(currentPrices);
                    }
                }

                // Kline data - save closed candles to DB
                // Kline data - save closed candles to DB
                if (stream.includes('@kline_') && data.k) {
                    const kline = data.k;
                    const interval = kline.i;

                    // Only save when candle is closed
                    if (kline.x === true) {
                        const symbol = kline.s;
                        const candle = {
                            openTime: kline.t,
                            open: parseFloat(kline.o),
                            high: parseFloat(kline.h),
                            low: parseFloat(kline.l),
                            close: parseFloat(kline.c),
                            volume: parseFloat(kline.v),
                            closeTime: kline.T
                        };

                        try {
                            await insertCandles(symbol, interval, [candle]);
                            console.log(`[PriceMonitor] Saved closed ${interval} candle for ${symbol}`);
                        } catch (err) {
                            console.error(`[PriceMonitor] Failed to save ${interval} candle for ${symbol}:`, err.message);
                        }
                    }
                }
            } catch (err) {
                // Silently skip parse errors
            }
        });

        ws.on('error', (err) => {
            console.error(`[PriceMonitor] ${isFutures ? 'Futures' : 'Spot'} WebSocket error:`, err.message);
        });

        ws.on('close', () => {
            console.log(`[PriceMonitor] ${isFutures ? 'Futures' : 'Spot'} WebSocket disconnected, reconnecting...`);
            setTimeout(() => connect(url, isFutures), 5000);
        });
    }

    connect(spotUrl, false);
    connect(futuresUrl, true);
}

function stopPriceMonitor() {
    if (wsConnection) {
        wsConnection.close();
        wsConnection = null;
    }
}

module.exports = {
    startPriceMonitor,
    stopPriceMonitor,
    getCurrentPrices
};
