/**
 * Signal Monitor Service
 * Runs after each candle close to detect new trading signals
 * and notify subscribed users via Telegram.
 */
const Backtester = require('../engine/backtester');
const { getCandleData } = require('../engine/dataFetcher');
const { sendSignalNotification } = require('./telegramBot');

// In-memory cache of last known signals per strategy+symbol
const lastSignals = {};

// All strategies to monitor
function getStrategies() {
    const strategyModules = [
        require('../engine/strategies/ma60'),
        require('../engine/strategies/dualEma'),
        require('../engine/strategies/threeStyle'),
        require('../engine/strategies/turtleBreakout'),
        require('../engine/strategies/macdMa'),
        require('../engine/strategies/granville_eth_4h'),
        require('../engine/strategies/dualSuperTrend'),
        require('../engine/strategies/donchianTrend'),
    ];
    const map = {};
    strategyModules.forEach(s => {
        if (s && s.id) map[s.id] = s;
    });
    return map;
}

// Symbol-strategy-timeframe combos to monitor
const MONITOR_COMBOS = [
    // BTC
    { symbol: 'BTCUSDT', strategyId: 'ma60', timeframe: '4h' },
    { symbol: 'BTCUSDT', strategyId: 'dual_ema', timeframe: '4h' },
    { symbol: 'BTCUSDT', strategyId: 'turtle_breakout', timeframe: '4h' },
    { symbol: 'BTCUSDT', strategyId: 'macd_ma_optimized', timeframe: '4h' },
    { symbol: 'BTCUSDT', strategyId: 'granville_eth_4h', timeframe: '4h' },
    { symbol: 'BTCUSDT', strategyId: 'dual_st_breakout', timeframe: '4h' },
    // ETH
    { symbol: 'ETHUSDT', strategyId: 'ma60', timeframe: '4h' },
    { symbol: 'ETHUSDT', strategyId: 'dual_ema', timeframe: '4h' },
    { symbol: 'ETHUSDT', strategyId: 'turtle_breakout', timeframe: '4h' },
    { symbol: 'ETHUSDT', strategyId: 'macd_ma_optimized', timeframe: '4h' },
    { symbol: 'ETHUSDT', strategyId: 'granville_eth_4h', timeframe: '4h' },
    { symbol: 'ETHUSDT', strategyId: 'dual_st_breakout', timeframe: '4h' },
    // SOL
    { symbol: 'SOLUSDT', strategyId: 'ma60', timeframe: '4h' },
    { symbol: 'SOLUSDT', strategyId: 'dual_ema', timeframe: '4h' },
    { symbol: 'SOLUSDT', strategyId: 'turtle_breakout', timeframe: '4h' },
    { symbol: 'SOLUSDT', strategyId: 'macd_ma_optimized', timeframe: '4h' },
    { symbol: 'SOLUSDT', strategyId: 'dual_st_breakout', timeframe: '4h' },
    // XAU (Gold)
    { symbol: 'XAUUSDT', strategyId: 'three_style', timeframe: '1h' },
    { symbol: 'XAUUSDT', strategyId: 'three_style', timeframe: '4h' },
    { symbol: 'XAUUSDT', strategyId: 'donchian_trend', timeframe: '4h' },
    { symbol: 'XAUUSDT', strategyId: 'dual_ema', timeframe: '4h' },
    { symbol: 'XAUUSDT', strategyId: 'granville_eth_4h', timeframe: '4h' },
    // Indices
    { symbol: 'SPXUSDT', strategyId: 'turtle_breakout', timeframe: '4h' },
    { symbol: 'NASUSDT', strategyId: 'turtle_breakout', timeframe: '4h' },
    { symbol: 'NQUSDT', strategyId: 'turtle_breakout', timeframe: '4h' },
    { symbol: 'ESUSDT', strategyId: 'turtle_breakout', timeframe: '4h' },
];

/**
 * Run a single backtest and check for new signals
 */
async function checkSignal(combo, strategiesMap) {
    const { symbol, strategyId, timeframe } = combo;
    const s = strategiesMap[strategyId];
    if (!s) return null;

    try {
        const candles = await getCandleData(symbol, timeframe, { daysBack: 30 });
        if (!candles || candles.length < 50) return null;

        const bt = new Backtester({ initialCapital: 10000 });
        const params = { ...s.defaultParams, symbol, timeframe };
        const strategyFn = s.createStrategy ? s.createStrategy(params) : s.execute;

        const result = bt.run(strategyFn, candles);
        if (!result.recentTrades || result.recentTrades.length === 0) return null;

        const latest = result.recentTrades[0];
        const signalKey = `${strategyId}_${symbol}_${timeframe}`;
        const oldSignal = lastSignals[signalKey];

        // Check if this is a NEW signal (different entry time or type)
        const isNew = !oldSignal ||
            oldSignal.entryTime !== latest.entryTime ||
            oldSignal.type !== latest.type;

        // CRITICAL: Recency Check
        // Only notify if the signal happened recently (e.g. within last 24 hours)
        // This prevents re-broadcasting old signals from 2 weeks ago on restart
        const now = Date.now();
        const signalTime = new Date(latest.entryTime).getTime();
        const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
        const isRecent = (now - signalTime) < MAX_AGE_MS;

        // Always update cache
        lastSignals[signalKey] = {
            entryTime: latest.entryTime,
            type: latest.type,
            entryPrice: latest.entryPrice,
            rule: latest.rule
        };

        if (isNew && isRecent) {
            return {
                strategyId,
                strategyName: s.name,
                symbol,
                timeframe,
                type: latest.type,
                price: latest.entryPrice,
                rule: latest.rule,
                entryTime: latest.entryTime
            };
        }

        return null;
    } catch (err) {
        console.error(`[SignalMonitor] Error checking ${strategyId}/${symbol}:`, err.message);
        return null;
    }
}

/**
 * Notify all subscribers of a new signal via Telegram
 */
async function notifySubscribers(signal, supabaseAdmin) {
    try {
        // Find all subscriptions for this strategy+symbol+timeframe
        // that have linked Telegram accounts
        const { data: subs, error } = await supabaseAdmin
            .from('subscriptions')
            .select('user_id')
            .eq('strategy_id', signal.strategyId)
            .eq('symbol', signal.symbol)
            .eq('timeframe', signal.timeframe);

        if (error || !subs || subs.length === 0) return 0;

        // Get Telegram chat IDs for these users
        const userIds = [...new Set(subs.map(s => s.user_id))];
        const { data: profiles } = await supabaseAdmin
            .from('profiles')
            .select('id, telegram_chat_id')
            .in('id', userIds)
            .not('telegram_chat_id', 'is', null);

        if (!profiles || profiles.length === 0) return 0;

        let sent = 0;
        for (const profile of profiles) {
            const result = await sendSignalNotification(profile.telegram_chat_id, signal);
            if (result) sent++;
        }

        console.log(`[SignalMonitor] Notified ${sent}/${profiles.length} users for ${signal.strategyId}/${signal.symbol}`);
        return sent;
    } catch (err) {
        console.error('[SignalMonitor] Notify error:', err.message);
        return 0;
    }
}

/**
 * Sync in-memory cache with database to prevent redundant notifications on restart
 */
async function syncLastSignals(supabaseAdmin) {
    if (Object.keys(lastSignals).length > 0) return; // Already hydrated

    try {
        const { data, error } = await supabaseAdmin
            .from('subscriptions')
            .select('strategy_id, symbol, timeframe, latest_signal')
            .not('latest_signal', 'is', null);

        if (error || !data) return;

        for (const sub of data) {
            const key = `${sub.strategy_id}_${sub.symbol}_${sub.timeframe}`;
            if (!lastSignals[key] && sub.latest_signal) {
                lastSignals[key] = {
                    entryTime: sub.latest_signal.time,
                    type: sub.latest_signal.type,
                    entryPrice: sub.latest_signal.price,
                    rule: sub.latest_signal.rule
                };
            }
        }
        console.log(`[SignalMonitor] Hydrated cache with ${Object.keys(lastSignals).length} existing signals from DB`);
    } catch (err) {
        console.error('[SignalMonitor] Sync error:', err.message);
    }
}

/**
 * Run the full signal check cycle
 */
async function runSignalCheck(supabaseAdmin) {
    await syncLastSignals(supabaseAdmin);

    const strategies = getStrategies();
    const startTime = Date.now();
    let newSignals = 0;

    console.log(`[SignalMonitor] Starting signal check (${MONITOR_COMBOS.length} combos)...`);

    for (const combo of MONITOR_COMBOS) {
        const signal = await checkSignal(combo, strategies);
        if (signal) {
            newSignals++;
            console.log(`[SignalMonitor] 🔔 NEW SIGNAL: ${signal.type} ${signal.symbol} @ $${signal.price} (${signal.strategyName})`);
            await notifySubscribers(signal, supabaseAdmin);

            // Also update latest_signal in subscriptions table
            try {
                await supabaseAdmin
                    .from('subscriptions')
                    .update({
                        latest_signal: {
                            type: signal.type,
                            price: signal.price,
                            time: signal.entryTime,
                            rule: signal.rule,
                            strategyName: signal.strategyName
                        }
                    })
                    .eq('strategy_id', signal.strategyId)
                    .eq('symbol', signal.symbol)
                    .eq('timeframe', signal.timeframe);
            } catch (err) {
                console.error('[SignalMonitor] DB update error:', err.message);
            }
        }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SignalMonitor] Check complete: ${newSignals} new signals found (${duration}s)`);
}

/**
 * Start the signal monitor with scheduled intervals
 */
let monitorInterval = null;

function startSignalMonitor(supabaseAdmin) {
    if (!supabaseAdmin) {
        console.error('[SignalMonitor] No Supabase admin client provided');
        return;
    }

    if (monitorInterval) {
        console.warn('[SignalMonitor] monitor already running, clearing old interval...');
        stopSignalMonitor();
    }

    // Initial check after 30 seconds (let data load first)
    setTimeout(() => {
        runSignalCheck(supabaseAdmin);
    }, 30000);

    // Then check every 15 minutes
    // (4h candle closes at :00:00, but we check more often to catch 1h candles too)
    monitorInterval = setInterval(() => {
        runSignalCheck(supabaseAdmin);
    }, 15 * 60 * 1000);

    console.log('[SignalMonitor] Started (checking every 15 min)');
}

function stopSignalMonitor() {
    if (monitorInterval) {
        clearInterval(monitorInterval);
        monitorInterval = null;
    }
}

module.exports = {
    startSignalMonitor,
    stopSignalMonitor,
    runSignalCheck,
    MONITOR_COMBOS
};
