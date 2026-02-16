/**
 * Granville Pro (Long/Short) - High ROI Version
 * Optimized for both ETH and BTC 4H
 */
module.exports = {
    id: 'granville_eth_4h',
    name: 'Granville Pro (ETH/BTC)',
    description: '葛蘭碧八大法則多空雙向版。針對不同幣種自動匹配最佳均線週期(60/100)與止損比例。',
    category: 'Premium',
    author: 'QuantSignal Pro',
    // Default params (ETH)
    params: {
        ma_period: 60,
        sl_pct: 0.06
    },
    run: (bars, params = {}) => {
        // Dynamic parameter selection based on data/symbol if provided
        // Default to ETH optimized params
        let ma_p = params.ma_period || 60;
        let sl = params.sl_pct || 0.06;

        // Auto-detect BTC from bar data if possible, or use passed params
        const isBtc = params.symbol === 'BTCUSDT';

        if (isBtc) {
            ma_p = 100;
            sl = 0.05;
        }

        const close = bars.map(b => b.close);
        const ema = [];
        const k = 2 / (ma_p + 1);
        let cur = close[0];
        for (let c of close) { cur = c * k + cur * (1 - k); ema.push(cur); }

        const signals = [];
        let pos = 0;
        let entryPrice = 0;

        for (let i = ma_p + 5; i < bars.length; i++) {
            const ma = ema[i];
            const maPrev = ema[i - 1];
            const maRising = ma > maPrev;
            const maFalling = ma < maPrev;
            const crossAbove = close[i] > ma && close[i - 1] <= maPrev;
            const crossBelow = close[i] < ma && close[i - 1] >= maPrev;

            // 1. Exit Logic
            if (pos > 0 && crossBelow) {
                signals.push({ time: bars[i].time, type: 'SELL', price: close[i], reason: 'Exit Long' });
                pos = 0;
            } else if (pos < 0 && crossAbove) {
                signals.push({ time: bars[i].time, type: 'COVER', price: close[i], reason: 'Exit Short' });
                pos = 0;
            }

            // 2. Stop Loss Check
            if (pos > 0 && close[i] <= entryPrice * (1 - sl)) {
                signals.push({ time: bars[i].time, type: 'SELL', price: close[i], reason: 'SL Long' });
                pos = 0;
            } else if (pos < 0 && close[i] >= entryPrice * (1 + sl)) {
                signals.push({ time: bars[i].time, type: 'COVER', price: close[i], reason: 'SL Short' });
                pos = 0;
            }

            // 3. Entry Logic
            if (pos === 0) {
                if (crossAbove && maRising) {
                    signals.push({ time: bars[i].time, type: 'BUY', price: close[i], rule: 'S1' });
                    pos = 1;
                    entryPrice = close[i];
                } else if (crossBelow && maFalling) {
                    signals.push({ time: bars[i].time, type: 'SHORT', price: close[i], rule: 'S5' });
                    pos = -1;
                    entryPrice = close[i];
                }
            }
        }
        return signals;
    }
};
