// Real-time Price Monitor via Binance WebSocket
const WebSocket = require('ws');
const { insertCandles } = require('./database');

const SYMBOLS = ['btcusdt', 'ethusdt', 'solusdt'];
const currentPrices = {};
let wsConnection = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000;

function getCurrentPrices() {
    return { ...currentPrices };
}

function startPriceMonitor() {
    const streams = SYMBOLS.map(s => `${s}@kline_4h`).join('/');
    const tickerStreams = SYMBOLS.map(s => `${s}@ticker`).join('/');
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}/${tickerStreams}`;

    function connect() {
        console.log('[PriceMonitor] Connecting to Binance WebSocket...');

        try {
            wsConnection = new WebSocket(url);
        } catch (err) {
            console.error('[PriceMonitor] Connection error:', err.message);
            scheduleReconnect();
            return;
        }

        wsConnection.on('open', () => {
            console.log('[PriceMonitor] Connected to Binance WebSocket');
            reconnectAttempts = 0;
        });

        wsConnection.on('message', async (rawData) => {
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
                if (stream.includes('@kline_4h') && data.k) {
                    const kline = data.k;

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
                            await insertCandles(symbol, '4h', [candle]);
                            console.log(`[PriceMonitor] Saved closed 4H candle for ${symbol} at ${new Date(kline.t).toISOString()}`);
                        } catch (err) {
                            console.error(`[PriceMonitor] Failed to save candle for ${symbol}:`, err.message);
                        }
                    }
                }
            } catch (err) {
                // Silently skip parse errors
            }
        });

        wsConnection.on('error', (err) => {
            console.error('[PriceMonitor] WebSocket error:', err.message);
        });

        wsConnection.on('close', () => {
            console.log('[PriceMonitor] WebSocket disconnected');
            scheduleReconnect();
        });
    }

    function scheduleReconnect() {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
        console.log(`[PriceMonitor] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})...`);
        setTimeout(connect, delay);
    }

    connect();
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
