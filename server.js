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

// 近三個月(90 天)策略績效排行:隨主快取每 4 小時重算,存記憶體(冷啟後數分鐘內填充)
let ranking90 = { computedAt: null, rows: [] };
app.get('/api/strategies/ranking90', (req, res) => res.json(ranking90));

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
        require('./src/engine/strategies/ichimoku_cloud'),
    ];

    // Same symbol × timeframe combinations shown on homepage
    const jobs = [];
    const cryptoSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XAUUSDT'];
    const indexSymbols = ['SPXUSDT', 'NQUSDT', 'ESUSDT', 'CLUSDT'];
    // Gold-specific strategies shown on homepage for PAXGUSDT
    const allowedGoldStrats = ['three_style', 'granville_eth_4h', 'turtle_breakout', 'dual_st_breakout', 'donchian_trend', 'dual_ema', 'ma60'];

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

            // Ichimoku Cloud extra timeframes
            if (s.id === 'ichimoku_cloud' && symbol === 'BTCUSDT') {
                jobs.push({ s, symbol, timeframe: '1h' });
            }
        }

        // PAXGUSDT: only selected gold strategies
        if (allowedGoldStrats.includes(s.id)) {
            if (s.id === 'three_style') {
                jobs.push({ s, symbol: 'PAXGUSDT', timeframe: '1h' });
                jobs.push({ s, symbol: 'PAXGUSDT', timeframe: '4h' });
            } else {
                jobs.push({ s, symbol: 'PAXGUSDT', timeframe: '4h' });
            }
        }

        // Stock index/futures: each symbol uses its best-performing strategy
        const indexStratMap = { SPXUSDT: 'turtle_breakout', NQUSDT: 'macd_ma_optimized', ESUSDT: 'turtle_breakout' };
        for (const symbol of ['SPXUSDT', 'NQUSDT', 'ESUSDT']) {
            if (s.id === indexStratMap[symbol]) {
                jobs.push({ s, symbol, timeframe: '4h' });
            }
        }

        // CL WTI crude oil: compute all 1h strategies except known-negative (macd_ma)
        if (s.id !== 'macd_ma_optimized') {
            jobs.push({ s, symbol: 'CLUSDT', timeframe: '1h' });
        }
    }

    let done = 0;
    const rank90Rows = [];
    for (const { s, symbol, timeframe } of jobs) {
        try {
            const isIndex = ['SPXUSDT', 'NQUSDT', 'ESUSDT', 'CLUSDT'].includes(symbol);
            const daysBack = isIndex ? (symbol === 'CLUSDT' ? 30 : 90) : (timeframe === '1h' ? 45 : 180);
            const candles = await getCandleData(symbol, timeframe, { daysBack });
            if (candles.length < 50) continue;

            let params = { ...s.defaultParams, symbol, timeframe };
            if (isIndex && s.id === 'turtle_breakout') {
                if (['NQUSDT', 'NQ'].includes(symbol)) params = { leftBars: 12, rightBars: 4, minHoldBars: 2 };
                else if (symbol === 'SPXUSDT') params = { leftBars: 6, rightBars: 5, minHoldBars: 15 };
                // ESUSDT 用預設參數(2/5/2):2026-08-01 對決 +2.2%,套 SPX 參數反而失真
            }
            const stratFn = s.createStrategy ? s.createStrategy(params) : s.execute;

            const backtester = new Backtester({ initialCapital: 10000, positionSize: 0.95, commission: 0, slippage: 0 });
            const result = backtester.run(stratFn, candles);
            const latestSignal = result.recentTrades?.[0] || null;

            await upsertStrategyPerformance(s.id, symbol, timeframe, result.summary, latestSignal);
            done++;

            // 90 天統一窗口(排行榜用;策略函式帶閉包狀態,必須重建)
            try {
                const c90 = await getCandleData(symbol, timeframe, { daysBack: 90 });
                if (c90.length >= 50) {
                    const fn90 = s.createStrategy ? s.createStrategy(params) : s.execute;
                    const r90 = backtester.run(fn90, c90);
                    if (r90?.summary) {
                        rank90Rows.push({
                            strategyId: s.id, strategyName: s.name, symbol, timeframe,
                            roi: r90.summary.totalReturn, winRate: r90.summary.winRate,
                            profitFactor: r90.summary.profitFactor, trades: r90.summary.totalTrades,
                        });
                    }
                }
            } catch (_e) { /* 排行缺一筆無妨 */ }
        } catch (e) {
            console.warn(`[StrategyCache] Skipped ${s.id}/${symbol}/${timeframe}: ${e.message}`);
        }
    }
    console.log(`✅ Strategy performance cache: ${done}/${jobs.length} entries saved to DB`);
    rank90Rows.sort((a, b) => b.roi - a.roi);
    ranking90 = { computedAt: new Date().toISOString(), windowDays: 90, rows: rank90Rows };
    console.log(`✅ 90d ranking: ${rank90Rows.length} rows`);

    // Re-run every 4 hours to keep data fresh
    setTimeout(() => computeStrategyPerformanceCache().catch(e => console.error('[StrategyCache] Refresh error:', e.message)), 4 * 60 * 60 * 1000);
}

start();

// Force restart to clear backtest cache and ensure consistency

// Force restart 4: CoinGecko Fallback for XAU (90d limit)
