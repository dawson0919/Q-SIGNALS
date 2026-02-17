
const Backtester = require('./src/engine/backtester');
const indicators = require('./src/engine/indicators');
const { getCandles } = require('./src/data/database');
require('dotenv').config();

async function optimizeXAUT() {
    console.log(`Optimizing XAUT for last 180 days (4H)...`);
    const allCandles = await getCandles('XAUTUSDT', '4h');
    if (!allCandles || allCandles.length < 200) {
        console.error("Not enough XAUT data");
        return;
    }
    const candles = allCandles.slice(-1280);
    const closes = candles.map(c => Number(c.close));

    let best = { roi: -999, ma: 0, sl: 0, useShort: true };

    for (let ma = 20; ma <= 180; ma += 5) {
        const ema = indicators.ema(closes, ma);
        for (let sl = 0.01; sl <= 0.08; sl += 0.01) {
            for (let useShort of [true, false]) {
                const bt = new Backtester({ commission: 0, slippage: 0 });
                const strategyFn = (c, id, i) => {
                    if (i < candles.length - 1080) return null;
                    const curP = closes[i];
                    const prevP = closes[i - 1];
                    const m = ema[i];
                    const mPrev = ema[i - 1];

                    if (!bt.position) {
                        if (curP > m && prevP <= mPrev) return 'BUY';
                        if (useShort && curP < m && prevP >= mPrev) return 'SELL';
                    } else {
                        if (bt.position.type === 'LONG' && curP < bt.position.entryPrice * (1 - sl)) return 'CLOSE_LONG';
                        if (bt.position.type === 'SHORT' && curP > bt.position.entryPrice * (1 + sl)) return 'CLOSE_SHORT';
                        if (bt.position.type === 'LONG' && curP < m && prevP >= mPrev) return useShort ? 'SELL' : 'CLOSE_LONG';
                        if (bt.position.type === 'SHORT' && curP > m && prevP <= mPrev) return 'BUY';
                    }
                    return null;
                };
                const result = bt.run(strategyFn, candles);
                if (result.summary.totalReturn > best.roi) {
                    best = { roi: result.summary.totalReturn, ma, sl, useShort };
                }
            }
        }
    }
    console.log(`\n=== XAUT Optimization Result ===`);
    console.log(`Best ROI: ${best.roi.toFixed(2)}%`);
    console.log(`MA Period: ${best.ma}`);
    console.log(`Stop Loss: ${(best.sl * 100).toFixed(1)}%`);
    console.log(`Use Short: ${best.useShort}`);
    console.log(`------------------------------------\n`);
}

optimizeXAUT();
