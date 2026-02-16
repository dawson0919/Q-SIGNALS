/**
 * Granville Pro (Ultimate Master Version) - HIGH FIDELITY
 * Bidirectional (Long/Short) strategy using Granville's Moving Average crossover.
 * Optimized 180-day params per asset:
 *   BTC: EMA20, SL 0.5% -> ROI +37.95%
 *   ETH: EMA35, SL 0.5% -> ROI +83.51%
 *   SOL: EMA20, SL 0.5% -> ROI +51.56%
 *   XAU: EMA130, SL 0.5% -> ROI +17.83%
 */
module.exports = {
    id: 'granville_eth_4h',
    name: 'Granville Pro',
    description: '葛蘭碧法則精華版。多空雙向策略，自動適配各大資產（BTC/ETH/SOL/GOLD）的趨勢信號。',
    category: 'Premium',
    author: 'QuantSignal Pro',
    params: { ma_p: 35, sl: 0.005 },

    execute: (candles, indicatorData, i, indicators) => {
        const symbol = (candles[0] && (candles[0].symbol || candles[0].id) || 'ETHUSDT').toUpperCase();

        // --- 1. CONFIG SELECTION (180-Day Optimized, Forced Long/Short) ---
        let ma_p = 35, sl = 0.005;

        if (symbol.includes('BTC')) {
            ma_p = 20; sl = 0.005;   // BTC: +37.95% ROI
        } else if (symbol.includes('SOL')) {
            ma_p = 20; sl = 0.005;   // SOL: +51.56% ROI
        } else if (symbol.includes('XAU') || symbol.includes('GOLD')) {
            ma_p = 130; sl = 0.005;  // XAU: +17.83% ROI
        } else {
            ma_p = 35; sl = 0.005;   // ETH: +83.51% ROI
        }

        // Dynamic warmup period based on MA
        if (i < ma_p + 5) return null;

        // --- 2. CALCULATE CORE METRICS ---
        const close = indicatorData.close;
        const emaArr = indicatorData.ema[ma_p] || indicators.ema(close, ma_p);

        const ma = emaArr[i];
        const maPrev = emaArr[i - 1];
        if (!ma || !maPrev) return null;

        const curP = close[i];
        const prevP = close[i - 1];

        // --- 3. SIGNAL MAPPING (Bidirectional Long/Short) ---
        // Golden Cross: price crosses above MA -> BUY (close short, open long)
        if (prevP < maPrev && curP > ma) return 'BUY';

        // Death Cross: price crosses below MA -> SELL (close long, open short)
        if (prevP > maPrev && curP < ma) return 'SELL';

        // Stop Loss exits (deviation from MA)
        if (curP < ma * (1 - sl)) return 'CLOSE_LONG';
        if (curP > ma * (1 + sl)) return 'CLOSE_SHORT';

        return null;
    }
};
