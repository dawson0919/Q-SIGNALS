// Strategy: Three-Blade MA Style (Triple EMA Trend)
// Logic:
// 1. Uses 3 EMAs: Fast (20), Medium (50), Slow (200)
// 2. Buy Condition: Fast > Medium > Slow (Full Bullish Alignment)
// 3. Sell Condition: Fast < Medium < Slow (Full Bearish Alignment)
// 4. Exit: When alignment breaks

const pineScript = `
//@version=5
strategy("Three-Blade MA", overlay=true)

fast_len = input.int(20, "Fast EMA")
mid_len = input.int(50, "Medium EMA")
slow_len = input.int(200, "Slow EMA")

fast_ema = ta.ema(close, fast_len)
mid_ema = ta.ema(close, mid_len)
slow_ema = ta.ema(close, slow_len)

// Bullish Alignment: Fast > Mid > Slow
bullish = fast_ema > mid_ema and mid_ema > slow_ema
// Bearish Alignment: Fast < Mid < Slow
bearish = fast_ema < mid_ema and mid_ema < slow_ema

if (bullish)
    strategy.entry("Long", strategy.long)

if (bearish)
    strategy.entry("Short", strategy.short)

// Optional: Exit when alignment breaks
if (strategy.position_size > 0 and not bullish)
    strategy.close("Long")
if (strategy.position_size < 0 and not bearish)
    strategy.close("Short")
`.trim();

function createStrategy(params = {}) {
    const fast = params.fast || 20;
    const mid = params.mid || 50;
    const slow = params.slow || 200;

    return function execute(candles, indicatorData, i, indicators) {
        const emaFast = indicatorData.ema[fast];
        const emaMid = indicatorData.ema[mid];
        const emaSlow = indicatorData.ema[slow];

        if (!emaFast || !emaMid || !emaSlow) return null;
        if (emaFast[i] === null || emaMid[i] === null || emaSlow[i] === null) return null;

        const f = emaFast[i];
        const m = emaMid[i];
        const s = emaSlow[i];

        // Bullish Alignment
        if (f > m && m > s) {
            return 'BUY';
        }

        // Bearish Alignment
        if (f < m && m < s) {
            return 'SELL';
        }

        // Close Long if alignment breaks
        // Note: The backtester handles 'BUY' as hold/entry. 
        // We need explicit close logic if we want to exit when alignment is lost.
        // But our simple backtester might toggle. 
        // For consistent trend following, 'BUY' holds the position.
        // If we want to exit on loss of alignment:

        // This is a "State" strategy.
        // If current state is NOT Bullish, we should probably close LONG.
        // If current state is NOT Bearish, we should probably close SHORT.

        // Let's refine:
        // Return 'BUY' keeps/opens Long.
        // Return 'SELL' keeps/opens Short.
        // Return null does nothing (holds previous).

        // However, to mimic "Close when alignment breaks":
        // We need to check current position state from backtester? 
        // The simple execute fn doesn't know current position.
        // BUT, we can return 'CLOSE_LONG' if we want to exit long.

        // Refined Logic:
        // If was bullish and now NOT bullish -> Close Long
        // If was bearish and now NOT bearish -> Close Short

        // But we don't have "was bullish".
        // Simpler:
        // Always return BUY if bullish.
        // Always return SELL if bearish.
        // If neither, return 'CLOSE_LONG' | 'CLOSE_SHORT' ? 
        // If we return CLOSE_LONG while short, it does nothing. Safe.

        if (!(f > m && m > s)) {
            // Not bullish
            // If we are long, this means exit.
            // We can return 'CLOSE_LONG'.
            // Wait, we can't return multiple signals.
            // If we are short, this doesn't affect us.
        }

        // Let's combine:
        if (f > m && m > s) return 'BUY';
        if (f < m && m < s) return 'SELL';

        // If neither:
        return 'CLOSE_LONG'; // Close long if we have one
        // Note: We might also want to CLOSE_SHORT.
        // return 'CLOSE_ALL'? Backtester doesn't support generic Close All yet?
        // Let's look at backtester.js: 
        // 'CLOSE_LONG' – close LONG, go flat
        // 'CLOSE_SHORT' – close SHORT, go flat

        // We can't return both. 
        // However, if we aren't bullish, we shouldn't be long.
        // If we aren't bearish, we shouldn't be short.

        // So:
        // If not bullish -> CLOSE_LONG
        // If not bearish -> CLOSE_SHORT
        // If we strictly follow this, we need to know what we have.

        // Hack: Strategy functions usually drive entry. Exits are tricky without state.
        // But let's assume standard trend following:
        // Enter Long on Bullish.
        // Enter Short on Bearish.
        // Exit Long when Fast < Mid (Trend weakening)
        // Exit Short when Fast > Mid (Trend weakening)

        if (f < m) return 'CLOSE_LONG'; // Exit Long
        if (f > m) return 'CLOSE_SHORT'; // Exit Short

        return null;
    };
}

module.exports = {
    id: 'three_blade',
    name: '均線三刀流 (Triple MA)',
    description: '使用 20/50/200 三條 EMA 進行趨勢判斷。當快中慢線多頭排列時做多，空頭排列時做空。',
    category: 'Premium',
    author: 'QuantSignal',
    pineScript,
    createStrategy,
    execute: createStrategy({ fast: 20, mid: 50, slow: 200 }),
    defaultParams: {
        fast: 20,
        mid: 50,
        slow: 200
    }
};
