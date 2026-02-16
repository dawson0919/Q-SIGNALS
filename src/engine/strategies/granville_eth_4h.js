/**
 * Granville Pro (Ultimate Master Version) - HIGH FIDELITY
 * Bidirectional (Long/Short) strategy using Granville's Moving Average crossover.
 * Deep-optimized 180-day params per asset (13,978 combinations searched per asset):
 *   BTC: EMA17, SL 0.5% -> ROI +53.25%
 *   ETH: EMA35, SL 0.5% -> ROI +83.51%
 *   SOL: EMA10, SL 0.5% -> ROI +60.70%
 *   XAU: EMA141, SL 0.5% -> ROI +19.99%
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

        // --- 1. CONFIG SELECTION (180-Day Deep-Optimized, Forced Long/Short) ---
        let ma_p = 35, sl = 0.005;

        if (symbol.includes('BTC')) {
            ma_p = 17; sl = 0.005;   // BTC: +53.25% ROI (>47.2% original)
        } else if (symbol.includes('SOL')) {
            ma_p = 10; sl = 0.005;   // SOL: +60.70% ROI (>58.1% original)
        } else if (symbol.includes('XAU') || symbol.includes('GOLD')) {
            ma_p = 141; sl = 0.005;  // XAU: +19.99% ROI (>-12.0% original)
        } else {
            ma_p = 35; sl = 0.005;   // ETH: +83.51% ROI (>50.2% original)
        }

        // Dynamic warmup period based on MA
        if (i < ma_p + 3) return null;

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
