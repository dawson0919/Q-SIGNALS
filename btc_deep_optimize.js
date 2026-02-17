
const Backtester = require('./src/engine/backtester');
const indicators = require('./src/engine/indicators');
const { getCandles } = require('./src/data/database');
require('dotenv').config();

async function optimizeBTC() {
    console.log(`Deep Optimizing BTC for last 180 days...`);
    const allCandles = await getCandles('BTCUSDT', '4h');
    const candles = allCandles.slice(-1280);
    const closes = candles.map(c => Number(c.close));

    let best = { roi: -999, ma: 0, sl: 0, useShort: false, dev: 999 };

    // Wider grid for BTC
    // Testing MA from 20 to 200
    // Testing SL from 2% to 15%
    // Testing Shorting vs Long-only
    // Testing Deviation Reversion (S4)
    for (let ma = 20; ma <= 180; ma += 5) {
        const ema = indicators.ema(closes, ma);
        for (let sl = 0.02; sl <= 0.12; sl += 0.01) {
            for (let useShort of [true, false]) {
                for (let devLimit of [0.03, 0.05, 0.08, 999]) {
                    const bt = new Backtester({ commission: 0, slippage: 0 });

                    const strategyFn = (c, id, i) => {
                        if (i < candles.length - 1080) return null; // Warm up
                        const curP = closes[i];
                        const prevP = closes[i - 1];
                        const m = ema[i];
                        const mPrev = ema[i - 1];
                        const d = (curP - m) / m;

                        // Entry Logic
                        if (!bt.position) {
                            if ((curP > m && prevP <= mPrev) || (d < -devLimit)) return 'BUY';
                            if (useShort && curP < m && prevP >= mPrev) return 'SELL';
                        } else {
                            // SL Logic
                            if (bt.position.type === 'LONG' && curP < bt.position.entryPrice * (1 - sl)) return 'CLOSE_LONG';
                            if (bt.position.type === 'SHORT' && curP > bt.position.entryPrice * (1 + sl)) return 'CLOSE_SHORT';

                            // Trend Exit
                            if (bt.position.type === 'LONG' && curP < m && prevP >= mPrev) return useShort ? 'SELL' : 'CLOSE_LONG';
                            if (bt.position.type === 'SHORT' && curP > m && prevP <= mPrev) return 'BUY';
                        }
                        return null;
                    };

                    const result = bt.run(strategyFn, candles);
                    if (result.summary.totalReturn > best.roi) {
                        best = { roi: result.summary.totalReturn, ma, sl, useShort, dev: devLimit };
                    }
                }
            }
        }
    }
    console.log(`\n=== BTC Deep Optimization Result ===`);
    console.log(`Best ROI: ${best.roi.toFixed(2)}%`);
    console.log(`MA Period: ${best.ma}`);
    console.log(`Stop Loss: ${(best.sl * 100).toFixed(1)}%`);
    console.log(`Use Short: ${best.useShort}`);
    console.log(`S4 Deviation: ${best.dev === 999 ? 'Disabled' : (best.dev * 100).toFixed(1) + '%'} `);
    console.log(`------------------------------------\n`);
    return best;
}

optimizeBTC();
