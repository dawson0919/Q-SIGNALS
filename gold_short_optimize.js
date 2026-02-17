
const Backtester = require('./src/engine/backtester');
const indicators = require('./src/engine/indicators');
const { getCandles } = require('./src/data/database');
require('dotenv').config();

async function optimizeGoldShort() {
    console.log(`Deep Optimizing Gold (XAUUSDT) for Long/Short (4H, 180 Days)...`);
    const allCandles = await getCandles('XAUUSDT', '4h');
    if (!allCandles || allCandles.length < 200) {
        console.error("Not enough data");
        return;
    }
    const candles = allCandles.slice(-1200); // ~200 days of 4h data
    candles.reverse(); // Ensure ascending
    const closes = candles.map(c => Number(c.close));

    let best = { roi: -999, ma: 0, sl: 0, useShort: true };

    // Wider range for deep optimization
    for (let ma = 10; ma <= 150; ma += 5) {
        const ema = indicators.ema(closes, ma);
        for (let sl = 0.01; sl <= 0.06; sl += 0.005) {
            const bt = new Backtester({ commission: 0, slippage: 0 });
            const strategyFn = (c, id, i) => {
                if (i < 150) return null;
                const m = ema[i];
                const mPrev = ema[i - 1];
                const curP = closes[i];
                const prevP = closes[i - 1];

                if (!bt.position) {
                    if (curP > m && prevP <= mPrev) return 'BUY';
                    if (curP < m && prevP >= mPrev) return 'SELL';
                } else {
                    // Stop Loss Check
                    if (bt.position.type === 'LONG' && curP < bt.position.entryPrice * (1 - sl)) return 'CLOSE_LONG';
                    if (bt.position.type === 'SHORT' && curP > bt.position.entryPrice * (1 + sl)) return 'CLOSE_SHORT';

                    // Reversal Signals
                    if (bt.position.type === 'LONG' && curP < m && prevP >= mPrev) return 'SELL';
                    if (bt.position.type === 'SHORT' && curP > m && prevP <= mPrev) return 'BUY';
                }
                return null;
            };

            const result = bt.run(strategyFn, candles);
            if (result.summary.totalReturn > best.roi) {
                best = { roi: result.summary.totalReturn, ma, sl, useShort: true };
            }
        }
    }

    console.log(`\n=== Gold Long/Short Optimization Results ===`);
    console.log(`Best ROI: ${best.roi.toFixed(2)}%`);
    console.log(`EMA Period: ${best.ma}`);
    console.log(`Stop Loss: ${(best.sl * 100).toFixed(1)}%`);
    console.log(`--------------------------------------------\n`);
}

optimizeGoldShort();
