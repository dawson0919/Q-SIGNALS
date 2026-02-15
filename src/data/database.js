// Supabase Database Connection
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zrhussirvsgsoffmrkxb.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_MERSBCkwCzs880gVcz_J7Q_urxy9azM';

let supabase = null;

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

async function addSubscription(userId, strategyId, token) {
    const { data, error } = await getAuthenticatedClient(token)
        .from('subscriptions')
        .upsert(
            { user_id: userId, strategy_id: strategyId },
            { onConflict: 'user_id, strategy_id', ignoreDuplicates: true }
        );

    if (error) {
        // Ignore duplicate key error, treat as success
        if (error.code === '23505') return { success: true };
        throw error;
    }
    return data;
}

async function removeSubscription(userId, strategyId, token) {
    const { error } = await getAuthenticatedClient(token)
        .from('subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('strategy_id', strategyId);
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
    const { data, error } = await getAuthenticatedClient(token)
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
    // 1. Update application status
    const { error: appError } = await getAuthenticatedClient(token)
        .from('premium_applications')
        .update({ status })
        .eq('id', id);
    if (appError) throw appError;

    // 2. If approved, upgrade profile role
    if (status === 'approved') {
        const { error: profileError } = await getAuthenticatedClient(token)
            .from('profiles')
            .update({ role: 'advanced' })
            .eq('id', userId);
        if (profileError) throw profileError;
    }
}

// --- Admin: User Management ---
async function getAllUsers(token) {
    const { data, error } = await getAuthenticatedClient(token)
        .from('profiles')
        .select('*');

    if (error) {
        console.error('[DB] getAllUsers Error:', error.message, error.details);
        return [];
    }

    // Apply Admin Override to listing (Removed - now handled by DB update in requireAdmin)
    /*
    return data.map(u => {
        if (u.email === 'nbamoment@gmail.com' || u.id === 'c337aaf8-b161-4d96-a6f4-35597dbdc4dd') {
            return { ...u, role: 'admin' };
        }
        return u;
    });
    */
    return data;
}

async function deleteUser(userId, token) {
    // Note: Deleting from auth.users requires service_role key.
    // Here we at least delete the profile and related data if RLS allows.
    const { error } = await getAuthenticatedClient(token)
        .from('profiles')
        .delete()
        .eq('id', userId);
    if (error) throw error;
}

module.exports = {
    initSupabase,
    getSupabase,
    getAuthenticatedClient,
    insertCandles,
    getCandles,
    getLatestCandleTime,
    getCandleCount,
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
    deleteUser
};
