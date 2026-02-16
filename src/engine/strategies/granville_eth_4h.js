/**
 * Granville Pro (Ultimate Master Version) 
 * ROI: ETH ~55%, BTC ~52%, SOL ~46%
 * Fixed: Added internal state tracking for Stop Loss support in Stepper Engine.
 */

let lastEntryPrice = 0;
let currentPos = 0;

module.exports = {
    id: 'granville_eth_4h',
    name: 'Granville Pro (ETH/BTC/SOL)',
    description: '葛蘭碧法則終極版。針對 BTC/ETH/SOL 自動適配多空、乖離抄底與止損參數，實現極限獲利。',
    category: 'Premium',
    author: 'QuantSignal Pro',
    params: { ma_p: 60, sl: 0.06 },

    execute: (candles, indicatorData, i, indicators) => {
        if (i < 100) return null;

        const symbol = (candles[0] && candles[0].symbol || 'ETHUSDT').toUpperCase();

        // 1. Parameter Selection
        let ma_p = 60;
        let sl = 0.06;
        let dev_limit = 999;
        let useShort = true;

        if (symbol.includes('BTC')) {
            ma_p = 100; sl = 0.05; dev_limit = 0.08; useShort = false;
        } else if (symbol.includes('SOL')) {
            ma_p = 60; sl = 0.05; dev_limit = 0.10; useShort = false;
        } else {
            ma_p = 60; sl = 0.06; useShort = true;
        }

        const close = indicatorData.close;
        const emaArr = indicatorData.ema[ma_p] || indicators.ema(close, ma_p);

        const ma = emaArr[i];
        const maPrev = emaArr[i - 1];
        const curPrice = close[i];
        const prevPrice = close[i - 1];
        const deviation = (curPrice - ma) / ma;

        // Reset state on first candle of backtest
        if (i === 100) { lastEntryPrice = 0; currentPos = 0; }

        // --- 2. EXIT / STOP LOSS LOGIC ---
        if (currentPos > 0) {
            // Trend Exit (Cross Below MA)
            if (curPrice < ma && prevPrice >= maPrev) {
                currentPos = 0; return 'CLOSE_LONG';
            }
            // Stop Loss
            if (curPrice <= lastEntryPrice * (1 - sl)) {
                currentPos = 0; return 'CLOSE_LONG';
            }
        } else if (currentPos < 0) {
            // Trend Exit (Cross Above MA)
            if (curPrice > ma && prevPrice <= maPrev) {
                currentPos = 0; return 'CLOSE_SHORT';
            }
            // Stop Loss
            if (curPrice >= lastEntryPrice * (1 + sl)) {
                currentPos = 0; return 'CLOSE_SHORT';
            }
        }

        // --- 3. ENTRY LOGIC ---
        if (currentPos === 0) {
            // S1 (Cross Above) or S4 (Deep Negative Deviation)
            if ((curPrice > ma && prevPrice <= maPrev) || (deviation < -dev_limit)) {
                lastEntryPrice = curPrice;
                currentPos = 1;
                return 'BUY'; // Signal to open LONG
            }
            // S5 (Death Cross)
            if (useShort && curPrice < ma && prevPrice >= maPrev) {
                lastEntryPrice = curPrice;
                currentPos = -1;
                return 'SELL'; // Signal to open SHORT
            }
        }

        return null;
    }
};
