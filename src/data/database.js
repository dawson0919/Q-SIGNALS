// Supabase Database Connection
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zrhussirvsgsoffmrkxb.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_MERSBCkwCzs880gVcz_J7Q_urxy9azM';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase = null;
let supabaseAdmin = null;

function initSupabase() {
    if (!supabase) {
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return supabase;
}

function getSupabase() {
    if (!supabase) return initSupabase();
    return supabase;
}

// Service Role Client - Bypasses ALL RLS policies. Use ONLY for admin operations.
function getAdminClient() {
    if (!supabaseAdmin) {
        if (!SUPABASE_SERVICE_ROLE_KEY) {
            console.error('[DB] WARNING: SUPABASE_SERVICE_ROLE_KEY not set! Admin queries will fail.');
            return getSupabase(); // Fallback (will still be blocked by RLS)
        }
        supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false }
        });
        console.log('[DB] Admin client initialized (Service Role - bypasses RLS)');
    }
    return supabaseAdmin;
}

function getAuthenticatedClient(token) {
    if (!token) return getSupabase();
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
            headers: { Authorization: `Bearer ${token}` }
        }
    });
}

// Insert candles in bulk (upsert)
async function insertCandles(symbol, timeframe, candles) {
    const rows = candles.map(c => ({
        symbol,
        timeframe,
        open_time: c.openTime,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
        close_time: c.closeTime
    }));

    // Batch insert in chunks of 500
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await getSupabase()
            .from('candles')
            .upsert(chunk, { onConflict: 'symbol,timeframe,open_time' });

        if (error) {
            console.error(`[DB] Insert error for ${symbol}:`, error.message);
            throw error;
        }
    }
    return rows.length;
}

// Get candles from DB
async function getCandles(symbol, timeframe, startTime, endTime) {
    let query = getSupabase()
        .from('candles')
        .select('*')
        .eq('symbol', symbol)
        .eq('timeframe', timeframe)
        .order('open_time', { ascending: false });

    if (startTime) query = query.gte('open_time', startTime);
    if (endTime) query = query.lte('open_time', endTime);

    const { data, error } = await query.limit(1000);
    if (error) {
        console.error('[DB] Query error:', error.message);
        return [];
    }
    return (data || []).reverse();
}

// Get latest candle timestamp for a symbol
async function getLatestCandleTime(symbol, timeframe) {
    const { data, error } = await getSupabase()
        .from('candles')
        .select('open_time')
        .eq('symbol', symbol)
        .eq('timeframe', timeframe)
        .order('open_time', { ascending: false })
        .limit(1);

    if (error || !data || data.length === 0) return null;
    return data[0].open_time;
}

// Get latest close price for a symbol
async function getLatestClosePrice(symbol) {
    // Try 1h timeframe first (more granular), then 4h
    const { data, error } = await getSupabase()
        .from('candles')
        .select('close, open_time')
        .eq('symbol', symbol)
        .order('open_time', { ascending: false })
        .limit(1);

    if (error || !data || data.length === 0) return null;
    return data[0].close;
}

// Get candle count
async function getCandleCount(symbol, timeframe) {
    const { count, error } = await getSupabase()
        .from('candles')
        .select('*', { count: 'exact', head: true })
        .eq('symbol', symbol)
        .eq('timeframe', timeframe);

    if (error) return 0;
    return count || 0;
}

// --- User Profiles ---
async function getProfile(userId, token) {
    const { data, error } = await getAuthenticatedClient(token)
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    if (error) return null;

    // Hardcode Super Admin Override (Removed - now handled by DB update in requireAdmin)
    /*
    if (data && (data.email === 'nbamoment@gmail.com' || data.id === 'c337aaf8-b161-4d96-a6f4-35597dbdc4dd')) {
        data.role = 'admin';
    }
    */

    return data;
}

async function updateProfile(userId, updates, token) {
    const { data, error } = await getAuthenticatedClient(token)
        .from('profiles')
        .update(updates)
        .eq('id', userId);
    if (error) throw error;
    return data;
}

// --- Subscriptions ---
async function getSubscriptions(userId, token) {
    const { data, error } = await getAuthenticatedClient(token)
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId);
    if (error) return [];
    return data;
}

async function addSubscription(userId, strategyId, token, symbol = 'BTCUSDT', timeframe = '4h') {
    const client = getAuthenticatedClient(token);

    // 1. Try Optimized Upsert (New Schema: ID + Symbol + Timeframe)
    // We explicitly specify onConflict to target the NEW constraint.
    // If the OLD constraint (ID only) exists, this might throw a violation error instead of ignoring.
    const { data, error } = await client
        .from('subscriptions')
        .upsert(
            { user_id: userId, strategy_id: strategyId, symbol, timeframe },
            { onConflict: 'user_id, strategy_id, symbol, timeframe', ignoreDuplicates: true }
        )
        .select();

    if (error) {
        console.warn(`[DB] Enhanced subscription upsert failed: ${error.message}. Attempting cleanup...`);

        // 2. Conflict Handling (Likely "Key (user_id, strategy_id)=(...) already exists")
        // If we can't coexist (due to old DB constraint), we SWAP.
        // DELETE existing subscription for this strategy to make room.
        const { error: delError } = await client
            .from('subscriptions')
            .delete()
            .eq('user_id', userId)
            .eq('strategy_id', strategyId); // Delete ANY version of this strategy

        if (!delError) {
            console.log(`[DB] Cleared old subscription for ${strategyId} to allow new insertion.`);
            // 3. Retry Insert after Delete
            const { data: retryData, error: retryError } = await client
                .from('subscriptions')
                .insert(
                    { user_id: userId, strategy_id: strategyId, symbol, timeframe }
                )
                .select();

            if (retryError) {
                console.error(`[DB] Retry insert failed: ${retryError.message}`);
                throw retryError;
            }
            return retryData;
        } else {
            console.error(`[DB] Failed to delete old sub: ${delError.message}`);
        }

        // Fallback to legacy (just in case it's a completely different error)
        return { success: false, error: error.message };
    }

    return data;
}

async function removeSubscription(userId, strategyId, token, symbol = 'BTCUSDT', timeframe = '4h') {
    const { error } = await getAuthenticatedClient(token)
        .from('subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('strategy_id', strategyId)
        .eq('symbol', symbol)
        .eq('timeframe', timeframe);
    if (error) throw error;
}

// --- Premium Applications ---
async function applyPremium(userId, email, account, token) {
    const { data, error } = await getAuthenticatedClient(token)
        .from('premium_applications')
        .insert({ user_id: userId, email, trading_account: account });
    if (error) throw error;
    return data;
}

async function getApplications(token) {
    // Use admin client to bypass RLS for admin operations
    const { data, error } = await getAdminClient()
        .from('premium_applications')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[DB] getApplications Error:', error.message, error.details);
        return [];
    }
    return data;
}

async function updateApplicationStatus(id, userId, status, token) {
    // Use admin client to bypass RLS for admin operations
    const { error: appError } = await getAdminClient()
        .from('premium_applications')
        .update({ status })
        .eq('id', id);
    if (appError) throw appError;

    // 2. If approved, upgrade profile role
    if (status === 'approved') {
        const { error: profileError } = await getAdminClient()
            .from('profiles')
            .update({ role: 'advanced' })
            .eq('id', userId);
        if (profileError) throw profileError;
    }
}

// --- Admin: User Management ---
async function getAllUsers(token) {
    // Use admin client (Service Role) to bypass RLS entirely
    const { data, error } = await getAdminClient()
        .from('profiles')
        .select('*');

    if (error) {
        console.error('[DB] getAllUsers Error:', error.message, error.details);
        return [];
    }

    console.log(`[DB] getAllUsers result count: ${data ? data.length : 0}`);

    // If profiles is empty, try to sync from auth.users
    if (!data || data.length === 0) {
        console.log('[DB] Profiles table is empty. Attempting to sync from auth.users...');
        const adminClient = getAdminClient();
        const { data: authUsers, error: authErr } = await adminClient.auth.admin.listUsers();
        if (authErr) {
            console.error('[DB] Failed to list auth users:', authErr.message);
            return [];
        }
        // Insert all auth users into profiles
        for (const u of (authUsers?.users || [])) {
            await adminClient.from('profiles').upsert({
                id: u.id,
                email: u.email,
                role: u.email === 'nbamoment@gmail.com' ? 'admin' : 'standard'
            }, { onConflict: 'id' });
        }
        console.log(`[DB] Synced ${authUsers?.users?.length || 0} users from auth.users`);
        // Re-query
        const { data: refreshed } = await adminClient.from('profiles').select('*');
        return refreshed || [];
    }

    return data;
}

async function adminUpdateUserRole(userId, role) {
    const { error } = await getAdminClient()
        .from('profiles')
        .update({ role })
        .eq('id', userId);
    if (error) throw error;
}

async function deleteUser(userId, token) {
    // Use admin client to delete profile (bypasses RLS)
    const { error } = await getAdminClient()
        .from('profiles')
        .delete()
        .eq('id', userId);
    if (error) throw error;
}

module.exports = {
    initSupabase,
    getSupabase,
    getAdminClient,
    getAuthenticatedClient,
    insertCandles,
    getCandles,
    getLatestCandleTime,
    getCandleCount,
    getLatestClosePrice,
    // Membership & Subscriptions
    getProfile,
    updateProfile,
    getSubscriptions,
    addSubscription,
    removeSubscription,
    applyPremium,
    getApplications,
    updateApplicationStatus,
    getAllUsers,
    adminUpdateUserRole,
    deleteUser
};
