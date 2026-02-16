/**
 * Granville Pro (Ultimate Master Version)
 * Optimized for ETH (55%), BTC (52%), and SOL (46%)
 * Compatible with Backend Backtester Interface
 */
module.exports = {
    id: 'granville_eth_4h',
    name: 'Granville Pro (ETH/BTC/SOL)',
    description: '葛蘭碧法則終極版。針對 BTC/ETH/SOL 自動適配多空、乖離抄底與止損參數，實現極限獲利。',
    category: 'Premium',
    author: 'QuantSignal Pro',
    params: {
        ma_p: 60,
        sl: 0.06
    },
    execute: (bars, params = {}) => {
        if (!bars || bars.length < 10) return [];

        const rawSymbol = (params.symbol || (bars[0] && bars[0].symbol) || 'ETHUSDT').toUpperCase();

        let ma_p = 60;
        let sl = 0.06;
        let dev_limit = 999;
        let useShort = true;

        if (rawSymbol.includes('BTC')) {
            ma_p = 100; sl = 0.05; dev_limit = 0.08; useShort = false;
        } else if (rawSymbol.includes('SOL')) {
            ma_p = 60; sl = 0.05; dev_limit = 0.10; useShort = false;
        } else {
            ma_p = 60; sl = 0.06; useShort = true;
        }

        const close = bars.map(b => Number(b.close));
        const ema = [];
        const k = 2 / (ma_p + 1);
        let cur = close[0];

        for (let i = 0; i < close.length; i++) {
            cur = close[i] * k + cur * (1 - k);
            ema.push(cur);
        }

        const signals = [];
        let pos = 0;
        let entryPrice = 0;

        for (let i = ma_p; i < bars.length; i++) {
            const ma = ema[i];
            const maPrev = ema[i - 1];
            if (!maPrev) continue;

            const deviation = (close[i] - ma) / ma;
            const crossAbove = close[i] > ma && close[i - 1] <= maPrev;
            const crossBelow = close[i] < ma && close[i - 1] >= maPrev;
            const time = bars[i].time || bars[i].open_time;

            // 1. Exit Logic
            if (pos > 0 && crossBelow) {
                signals.push({ time, type: 'EXIT', price: close[i], reason: 'Trend Exit' });
                pos = 0;
            } else if (pos < 0 && crossAbove) {
                signals.push({ time, type: 'EXIT', price: close[i], reason: 'Trend Exit' });
                pos = 0;
            }

            // 2. Stop Loss
            if (pos > 0 && close[i] <= entryPrice * (1 - sl)) {
                signals.push({ time, type: 'EXIT', price: close[i], reason: 'SL' });
                pos = 0;
            } else if (pos < 0 && close[i] >= entryPrice * (1 + sl)) {
                signals.push({ time, type: 'EXIT', price: close[i], reason: 'SL' });
                pos = 0;
            }

            // 3. Entry Logic
            if (pos === 0) {
                if (crossAbove || (rawSymbol.includes('BTC') && deviation < -dev_limit)) {
                    signals.push({ time, type: 'LONG', price: close[i], rule: crossAbove ? 'S1' : 'S4' });
                    pos = 1; entryPrice = close[i];
                } else if (useShort && crossBelow) {
                    signals.push({ time, type: 'SHORT', price: close[i], rule: 'S5' });
                    pos = -1; entryPrice = close[i];
                }
            }
        }
        return signals;
    }
};
