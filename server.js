// QuantSignal Server - Quantitative Trading Strategy Platform
require('dotenv').config(); // Load .env BEFORE any other modules
const express = require('express');
const cors = require('cors');
const path = require('path');
const { WebSocketServer } = require('ws');
const http = require('http');

const { initSupabase, getAdminClient, upsertStrategyPerformance } = require('./src/data/database');
const { backfillAllSymbols, startScheduledSync } = require('./src/data/backfill');
const { startPriceMonitor, getCurrentPrices } = require('./src/data/priceMonitor');
const { startPolling: startTelegramBot } = require('./src/services/telegramBot');
const { startSignalMonitor } = require('./src/services/signalMonitor');
const apiRoutes = require('./src/api/routes');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Trust reverse proxy (Railway / Heroku / Render) so rate limiters use real client IP
// from X-Forwarded-For, not the proxy's IP
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api', apiRoutes);

// WebSocket for live price streaming and online status
const wss = new WebSocketServer({ server, path: '/ws/prices' });
const onlineUsers = new Map(); // Store userId -> Set of sockets

wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const userId = url.searchParams.get('userId');

    if (userId && userId !== 'null' && userId !== 'undefined') {
        if (!onlineUsers.has(userId)) {
            onlineUsers.set(userId, new Set());
        }
        onlineUsers.get(userId).add(ws);
        console.log(`[WS] User ${userId} connected. Total unique: ${onlineUsers.size}`);
    } else {
        console.log('[WS] Anonymous client connected');
    }

    // Send current prices immediately
    const prices = getCurrentPrices();
    if (Object.keys(prices).length > 0) {
        ws.send(JSON.stringify({ type: 'prices', data: prices }));
    }

    ws.on('close', () => {
        if (userId && onlineUsers.has(userId)) {
            const sockets = onlineUsers.get(userId);
            sockets.delete(ws);
            if (sockets.size === 0) {
                onlineUsers.delete(userId);
            }
            console.log(`[WS] User ${userId} tab closed. Total unique: ${onlineUsers.size}`);
        } else {
            console.log('[WS] Anonymous client disconnected');
        }
    });
});

// Broadcast price updates to all connected clients
function broadcastPrices(data) {
    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(JSON.stringify({ type: 'prices', data }));
        }
    });
}

// Global accessor for routes to check online status
global.getOnlineUsers = () => Array.from(onlineUsers.keys());
global.broadcastPrices = broadcastPrices;

// Start server
async function start() {
    try {
        console.log('🚀 Starting QuantSignal Server...');

        // 1. Initialize Supabase
        const supabase = initSupabase();
        console.log('✅ Supabase connected');

        // 5. Start HTTP server
        server.listen(PORT, () => {
            console.log(`\n🟢 QuantSignal running at http://localhost:${PORT}`);
            console.log(`   WebSocket: ws://localhost:${PORT}/ws/prices`);
            console.log(`   Admin: http://localhost:${PORT}/admin.html`);

            // Trigger backfill in background after server is listening
            startBackgroundTasks();
        });

    } catch (err) {
        console.error('❌ Startup error:', err);
        process.exit(1);
    }
}

async function startBackgroundTasks() {
    try {
        // 2. Backfill historical data (now in background)
        console.log('📊 Starting background historical data backfill...');
        await backfillAllSymbols();
        console.log('✅ Background historical data backfill complete');

        // 3. Start real-time price monitor
        startPriceMonitor();
        console.log('✅ Real-time price monitor started');

        // 4. Start scheduled sync (every 4 hours)
        startScheduledSync();
        console.log('✅ Scheduled sync started (every 4h)');

        // 5. Start Telegram Bot (polling mode)
        const db = { getSupabaseAdmin: getAdminClient };
        startTelegramBot(db);
        console.log('✅ Telegram Bot started');

        // 6. Start Signal Monitor
        const adminClient = getAdminClient();
        startSignalMonitor(adminClient);
        console.log('✅ Signal Monitor started');

        // 7. Pre-compute strategy performance cache for homepage
        console.log('⚙️  Pre-computing strategy performance cache...');
        computeStrategyPerformanceCache().catch(err =>
            console.error('❌ Strategy cache error:', err.message)
        );
    } catch (err) {
        console.error('❌ Background task error:', err);
    }
}

// Pre-compute all strategy × symbol backtest results and persist to DB.
// This allows the homepage to read pre-built data instead of running live backtests.
async function computeStrategyPerformanceCache() {
    const Backtester = require('./src/engine/backtester');
    const { getCandleData } = require('./src/engine/dataFetcher');

    // Load strategy modules
    const strategyModules = [
        require('./src/engine/strategies/ma60'),
        require('./src/engine/strategies/threeStyle'),
        require('./src/engine/strategies/turtleBreakout'),
        require('./src/engine/strategies/dualEma'),
        require('./src/engine/strategies/macdMa'),
        require('./src/engine/strategies/granville_eth_4h'),
        require('./src/engine/strategies/dualSuperTrend'),
        require('./src/engine/strategies/donchianTrend'),
    ];

    // Same symbol × timeframe combinations shown on homepage
    const jobs = [];
    const cryptoSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XAUUSDT'];
    const indexSymbols  = ['SPXUSDT', 'NASUSDT'];

    for (const s of strategyModules) {
        for (const symbol of cryptoSymbols) {
            if (s.id === 'dual_st_breakout' && symbol === 'XAUUSDT') continue;
            // Gold: three_style gets both 1h and 4h; granville_eth_4h gets 4h only
            if (symbol === 'XAUUSDT' && s.id === 'three_style') {
                jobs.push({ s, symbol, timeframe: '1h' });
                jobs.push({ s, symbol, timeframe: '4h' });
            } else {
                jobs.push({ s, symbol, timeframe: '4h' });
            }
        }
        // Only turtle_breakout runs on index symbols
        if (s.id === 'turtle_breakout') {
            for (const symbol of indexSymbols) {
                jobs.push({ s, symbol, timeframe: '4h' });
            }
        }
    }

    let done = 0;
    for (const { s, symbol, timeframe } of jobs) {
        try {
            const isIndex = (symbol === 'SPXUSDT' || symbol === 'NASUSDT');
            const daysBack = isIndex ? 90 : (timeframe === '1h' ? 45 : 180);
            const candles = await getCandleData(symbol, timeframe, { daysBack });
            if (candles.length < 50) continue;

            let params = { ...s.defaultParams, symbol, timeframe };
            if (isIndex && s.id === 'turtle_breakout') {
                if (symbol === 'NASUSDT') params = { leftBars: 4, rightBars: 5, minHoldBars: 20 };
                else params = { leftBars: 6, rightBars: 5, minHoldBars: 15 };
            }
            const stratFn = s.createStrategy ? s.createStrategy(params) : s.execute;

            const backtester = new Backtester({ initialCapital: 10000, positionSize: 0.95, commission: 0, slippage: 0 });
            const result = backtester.run(stratFn, candles);
            const latestSignal = result.recentTrades?.[0] || null;

            await upsertStrategyPerformance(s.id, symbol, timeframe, result.summary, latestSignal);
            done++;
        } catch (e) {
            console.warn(`[StrategyCache] Skipped ${s.id}/${symbol}/${timeframe}: ${e.message}`);
        }
    }
    console.log(`✅ Strategy performance cache: ${done}/${jobs.length} entries saved to DB`);

    // Re-run every 4 hours to keep data fresh
    setTimeout(() => computeStrategyPerformanceCache().catch(e => console.error('[StrategyCache] Refresh error:', e.message)), 4 * 60 * 60 * 1000);
}

start();

// Force restart to clear backtest cache and ensure consistency

// Force restart 4: CoinGecko Fallback for XAU (90d limit)
