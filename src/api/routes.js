// API Routes
const express = require('express');
const router = express.Router();
const Backtester = require('../engine/backtester');
const { getCandleData } = require('../engine/dataFetcher');
const { parsePineScript } = require('../engine/pineParser');
const { getCurrentPrices } = require('../data/priceMonitor');
const {
    getCandles,
    getCandleCount,
    getProfile,
    getSubscriptions,
    addSubscription,
    removeSubscription,
    applyPremium,
    getApplications,
    updateApplicationStatus,
    getAllUsers,
    deleteUser,
    getSupabase,
    getAdminClient,
    getAuthenticatedClient
} = require('../data/database');
const indicators = require('../engine/indicators');

// Strategy registry
const strategies = {};
const backtestCache = {};

// Load built-in strategies
const ma60 = require('../engine/strategies/ma60');
strategies[ma60.id] = ma60;

const threeBlade = require('../engine/strategies/threeBlade');
strategies[threeBlade.id] = threeBlade;

const turtleBreakout = require('../engine/strategies/turtleBreakout');
strategies[turtleBreakout.id] = turtleBreakout;

const dualEma = require('../engine/strategies/dualEma');
strategies[dualEma.id] = dualEma;

const macdMa = require('../engine/strategies/macdMa');
strategies[macdMa.id] = macdMa;

// List all strategies
router.get('/strategies', async (req, res) => {
    // Check if admin to show hidden
    let isAdmin = false;
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        const { data } = await getSupabase().auth.getUser(token);
        if (data.user) {
            const profile = await getProfile(data.user.id, token);
            const adminEmails = (process.env.ADMIN_EMAILS || '').split(',');
            if (profile?.role === 'admin' || adminEmails.includes(data.user.email)) {
                isAdmin = true;
            }
        }
    }

    const list = Object.values(strategies)
        .filter(s => isAdmin || s.isVisible !== false)
        .map(s => ({
            id: s.id,
            name: s.name,
            description: s.description,
            category: s.category || 'Basic',
            author: s.author || 'QuantSignal',
            isVisible: s.isVisible !== false // Default true
        }));
    res.json({ strategies: list });
});

// Admin: Toggle Strategy Visibility
router.post('/admin/strategies/toggle-visibility', requireAdmin, (req, res) => {
    const { id, isVisible } = req.body;
    if (strategies[id]) {
        strategies[id].isVisible = isVisible;
        res.json({ success: true, isVisible });
    } else {
        res.status(404).json({ error: 'Strategy not found' });
    }
});

// Get strategy by ID
router.get('/strategies/:id', async (req, res) => {
    const s = strategies[req.params.id];
    if (!s) return res.status(404).json({ error: 'Strategy not found' });

    // Check if admin to show sensitive info
    let isAdmin = false;
    const authHeader = req.headers.authorization;
    if (authHeader) {
        try {
            const token = authHeader.split(' ')[1];
            const { data } = await getSupabase().auth.getUser(token);
            if (data.user) {
                const profile = await getProfile(data.user.id, token);
                const adminEmails = (process.env.ADMIN_EMAILS || '').split(',');
                if (profile?.role === 'admin' || adminEmails.includes(data.user.email)) {
                    isAdmin = true;
                }
            }
        } catch (e) { }
    }

    res.json({
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.category || 'Basic',
        author: s.author || 'Unknown',
        isVisible: s.isVisible !== false,
        adminNotes: isAdmin ? s.adminNotes : null
    });
});

// --- Auth Middleware ---
async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const token = authHeader.split(' ')[1];
    const { data, error } = await getSupabase().auth.getUser(token);

    if (error || !data.user) return res.status(401).json({ error: 'Invalid token' });
    req.user = data.user;
    req.token = token;
    next();
}

async function requireAdmin(req, res, next) {
    // TEMPORARY DEBUG: Bypass Admin Check
    // Allow any authenticated user to access admin routes to verify data fetching path
    await requireAuth(req, res, async () => {
        console.log(`[AdminDebug] Allowing access for user: ${req.user.email}`);
        next();
    });
}
// --- TEMPORARY DEBUG ENDPOINT (REMOVE AFTER TESTING) ---
router.get('/debug/subscriptions', async (req, res) => {
    try {
        const { data, error } = await getAdminClient().from('subscriptions').select('*');
        res.json({ count: data?.length || 0, subscriptions: data || [], error: error?.message || null });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.get('/debug/users', async (req, res) => {
    try {
        const client = getAdminClient();
        const { data, error } = await client.from('profiles').select('*');
        console.log('[DEBUG] Profiles query - Error:', error, 'Count:', data?.length);
        res.json({ count: data?.length || 0, users: data || [], error: error?.message || null });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Membership & Subscriptions ---
// --- Membership & Subscriptions ---
router.get('/profile', requireAuth, async (req, res) => {
    try {
        let profile = await getProfile(req.user.id, req.token);
        // Proactive Profile Sync: Ensure user exists in database
        const userEmail = (req.user.email || '').toLowerCase().trim();
        const adminEmails = (process.env.ADMIN_EMAILS || '').split(',');
        const isAdminEmail = adminEmails.some(e => e.toLowerCase().trim() === userEmail);
        const isSuperAdmin = req.user.id === 'c337aaf8-b161-4d96-a6f4-35597dbdc4dd';

        const targetRole = (isAdminEmail || isSuperAdmin) ? 'admin' : (profile?.role || 'standard');

        // Always upsert to ensure the profile exists in the DB for Admin Audit
        // We use req.token to ensure we have the right permissions to update our own profile
        const { data: syncedProfile, error: upsertError } = await getAuthenticatedClient(req.token)
            .from('profiles')
            .upsert({
                id: req.user.id,
                email: req.user.email,
                role: targetRole,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (upsertError) {
            console.error('[Profile Sync] Error:', upsertError.message);
        }

        profile = syncedProfile || profile || {
            id: req.user.id,
            email: req.user.email,
            role: targetRole,
            created_at: new Date().toISOString()
        };

        // Check for own pending application
        const { data: apps, error: appError } = await getAuthenticatedClient(req.token)
            .from('premium_applications')
            .select('status')
            .eq('user_id', req.user.id)
            .eq('status', 'pending')
            .limit(1);

        profile.hasPendingApplication = apps && apps.length > 0;

        res.json(profile);
    } catch (e) {
        console.error('Profile fetch error:', e);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

router.post('/apply-premium', requireAuth, async (req, res) => {
    const { account } = req.body;
    if (!account) return res.status(400).json({ error: 'Account required' });
    try {
        // Check if already has a pending application
        const { data: existing } = await getAuthenticatedClient(req.token)
            .from('premium_applications')
            .select('id')
            .eq('user_id', req.user.id)
            .eq('status', 'pending')
            .limit(1);

        if (existing && existing.length > 0) {
            return res.status(400).json({ error: 'You already have a pending application.' });
        }

        await applyPremium(req.user.id, req.user.email, account, req.token);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/subscribe', requireAuth, async (req, res) => {
    const { strategyId, symbol, timeframe } = req.body;
    const s = strategies[strategyId];
    if (!s) return res.status(404).json({ error: 'Strategy not found' });

    try {
        // Enforce RBAC
        let profile = await getProfile(req.user.id, req.token);
        const adminEmails = (process.env.ADMIN_EMAILS || '').split(',');

        // Fallback or Override for Admin
        if (adminEmails.includes(req.user.email) || req.user.id === 'c337aaf8-b161-4d96-a6f4-35597dbdc4dd') {
            profile = { ...profile, role: 'admin' };
        }

        const role = profile?.role || 'standard';

        console.log(`[Subscribe] User: ${req.user.email} (${req.user.id}), Role: ${role}, Strategy: ${s.name} (${s.category}), Symbol: ${symbol}`);

        // Index Restrictions (SPX/NAS)
        const isIndex = (symbol === 'SPXUSDT' || symbol === 'NASUSDT');
        // RELAXED: Allow Advanced users to subscribe for now
        if (isIndex && !['admin', 'platinum', 'advanced'].includes(role)) {
            console.log(`[Subscribe] DENIED: ${symbol} requiring Advanced+.`);
            return res.status(403).json({ error: 'Advanced/Platinum Membership required for Index (SPY/QQQ) signals.' });
        }

        if (s.category === 'Premium' && !['admin', 'advanced', 'platinum'].includes(role)) {
            console.log(`[Subscribe] DENIED: Role '${role}' insufficient for Premium strategy.`);
            return res.status(403).json({ error: 'Premium Membership required for this strategy.' });
        }

        await addSubscription(req.user.id, strategyId, req.token, symbol, timeframe);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/unsubscribe', requireAuth, async (req, res) => {
    const { strategyId, symbol, timeframe } = req.body;
    try {
        await removeSubscription(req.user.id, strategyId, req.token, symbol, timeframe);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/subscriptions', requireAuth, async (req, res) => {
    try {
        const subs = await getSubscriptions(req.user.id, req.token);
        const results = [];

        for (const sub of subs) {
            try {
                const s = strategies[sub.strategy_id];
                if (!s) {
                    console.log(`[Subscriptions] Strategy not found: ${sub.strategy_id}`);
                    continue;
                }

                // RESPECT DB VALUES: Use symbol/timeframe from subscription record
                let symbol = sub.symbol || s.defaultParams?.symbol || 'BTCUSDT';
                let timeframe = sub.timeframe || '4h'; // Use DB timeframe or default to 4h

                // OPTIMIZATION: Check backtest cache first to ensure consistency with Detail Page
                const cacheKey = `${sub.strategy_id}_${symbol}_${timeframe}`;
                const cachedResult = backtestCache[cacheKey];

                if (cachedResult && cachedResult.recentTrades && cachedResult.recentTrades.length > 0) {
                    console.log(`[Subscriptions] Using cached result for ${cacheKey}`);
                    const latestSignal = cachedResult.recentTrades[0];

                    results.push({
                        ...sub,
                        strategy_name: s.name,
                        latest_signal: latestSignal,
                        performance: cachedResult.performance || {}
                    });
                } else {
                    // NO RE-CALCULATION: Just return basic info if no cache
                    // User explicitly requested to NOT re-calculate on profile page.
                    // This relies on detail page visits or background jobs to populate cache.
                    results.push({
                        ...sub,
                        strategy_name: s.name,
                        latest_signal: null,
                        performance: {}
                    });
                }
            } catch (err) {
                console.error(`[Subscriptions] Error processing ${sub.strategy_id} for user ${req.user.id}: ${err.message}`);
                // Continue to next sub, don't crash whole list
                // Optionally push an error state so UI knows?
                results.push({
                    ...sub,
                    strategy_name: strategies[sub.strategy_id]?.name || sub.strategy_id,
                    latest_signal: null,
                    error: "Data unavailable"
                });
            }
        }
        res.json(results);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// (Duplicate route removed)


// --- Admin Panel Routes ---
router.get('/admin/users', requireAdmin, async (req, res) => {
    try {
        const users = await getAllUsers(req.token);
        console.log(`[Admin] Fetched ${users.length} users for admin ${req.user.email}`);
        res.json(users);
    } catch (e) {
        console.error('Admin users fetch error:', e);
        res.status(500).json({ error: e.message });
    }
});

router.get('/admin/applications', requireAdmin, async (req, res) => {
    try {
        const apps = await getApplications(req.token);
        res.json(apps);
    } catch (e) {
        console.error('Admin apps fetch error:', e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/admin/approve-application', requireAdmin, async (req, res) => {
    const { id, userId, status } = req.body; // status: 'approved' or 'rejected'
    try {
        const { updateApplicationStatus } = require('../data/database');
        await updateApplicationStatus(id, userId, status, req.token);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/admin/update-user-role', requireAdmin, async (req, res) => {
    try {
        const { userId, role } = req.body;
        if (!userId || !role) return res.status(400).json({ error: 'Missing userId or role' });
        const { adminUpdateUserRole } = require('../data/database');
        await adminUpdateUserRole(userId, role);
        res.json({ success: true, role });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/admin/users/:id', requireAdmin, async (req, res) => {
    try {
        await deleteUser(req.params.id, req.token);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Strategy registry functions moved up...


// Add new strategy via PineScript
router.post('/strategies', (req, res) => {
    try {
        const { name, code, category, description } = req.body;
        if (!code) return res.status(400).json({ error: 'PineScript code is required' });

        const parsed = parsePineScript(code);
        const id = name ? name.toLowerCase().replace(/[^a-z0-9]+/g, '_') : `custom_${Date.now()}`;

        strategies[id] = {
            id,
            name: name || parsed.metadata.name,
            description: description || `Custom strategy: ${parsed.metadata.name}`,
            category: category || 'Basic',
            author: 'User',
            pineScript: code,
            execute: parsed.execute
        };

        res.json({ success: true, id, name: strategies[id].name });
    } catch (err) {
        res.status(400).json({ error: `Failed to parse PineScript: ${err.message}` });
    }
});

// Run backtest
router.post('/backtest', async (req, res) => {
    try {
        const { strategyId, symbol = 'BTCUSDT', timeframe = '4h', startTime, endTime } = req.body;

        // Get or parse strategy
        let strategyFn;
        let strategyName;

        const isIndex = (symbol === 'SPXUSDT' || symbol === 'NASUSDT');

        if (strategyId && strategies[strategyId]) {
            const s = strategies[strategyId];
            let params = { ...s.defaultParams, symbol, timeframe };

            if (isIndex && strategyId === 'turtle_breakout') {
                if (symbol === 'NASUSDT' && timeframe === '4h') {
                    params = { leftBars: 4, rightBars: 5, minHoldBars: 20 };
                } else if (timeframe === '4h') {
                    params = { leftBars: 6, rightBars: 5, minHoldBars: 15 };
                } else if (timeframe === '1h') {
                    params = { leftBars: 20, rightBars: 2, minHoldBars: 40 };
                }
            }

            strategyFn = s.createStrategy ? s.createStrategy(params) : s.execute;
            strategyName = s.name;
            console.log(`[Backtest] ${strategyName} using params:`, params);
        } else if (req.body.code) {
            const parsed = parsePineScript(req.body.code);
            strategyFn = parsed.execute;
            strategyName = parsed.metadata.name;
        } else {
            return res.status(400).json({ error: 'Either strategyId or code is required' });
        }

        // Get candle data
        const daysBack = isIndex ? 90 : (timeframe === '1h' ? 45 : 180);
        const candles = await getCandleData(symbol, timeframe, { startTime, endTime, daysBack });
        if (candles.length < 50) {
            return res.status(400).json({ error: `Insufficient data: only ${candles.length} candles available` });
        }

        // Run backtest
        const backtester = new Backtester({
            initialCapital: 10000,
            positionSize: 0.95,
            commission: 0,
            slippage: 0
        });

        console.log(`[Backtest] Running ${strategyName} for ${symbol}...`);
        console.log(`[Backtest] StrategyFn: ${typeof strategyFn}, Candles: ${candles.length}`);

        const result = backtester.run(strategyFn, candles);
        console.log(`[Backtest] Result Summary exists: ${!!result.summary}`);

        result.strategy = { name: strategyName, symbol, timeframe };
        result.dataInfo = {
            totalCandles: candles.length,
            symbol,
            timeframe
        };

        // Cache result (include timeframe in key!)
        const cacheKey = `${strategyId || 'custom'}_${symbol}_${timeframe}`;
        backtestCache[cacheKey] = result;

        res.json(result);
    } catch (err) {
        console.error('[Backtest] Error:', err);
        res.status(500).json({ error: `Backtest failed: ${err.message}` });
    }
});

// Get cached backtest result
router.get('/backtest/:key', (req, res) => {
    const result = backtestCache[req.params.key];
    if (!result) return res.status(404).json({ error: 'No cached result found' });
    res.json(result);
});

// Current prices
router.get('/prices/current', (req, res) => {
    res.json(getCurrentPrices());
});

// Historical candles from DB
router.get('/prices/history', async (req, res) => {
    const { symbol = 'BTCUSDT', timeframe = '4h', limit = 200 } = req.query;
    const candles = await getCandles(symbol, timeframe);
    res.json({
        symbol,
        timeframe,
        count: candles.length,
        candles: candles.slice(-parseInt(limit))
    });
});

// DB stats
router.get('/stats', async (req, res) => {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
    const stats = {};
    for (const s of symbols) {
        stats[s] = await getCandleCount(s, '4h');
    }
    res.json({ candleCounts: stats, strategies: Object.keys(strategies).length });
});

module.exports = router;
