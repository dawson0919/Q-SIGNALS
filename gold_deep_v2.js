
const Backtester = require('./src/engine/backtester');
const indicators = require('./src/engine/indicators');
const { getCandles } = require('./src/data/database');
require('dotenv').config();

async function optimizeGoldAdvanced() {
    const allCandles = await getCandles('XAUUSDT', '4h');
    const candles = allCandles.slice(-1200);
    candles.reverse();
    const closes = candles.map(c => Number(c.close));

    let bestLongShort = { roi: -999, ma: 0, sl: 0 };

    // Grid search for Long/Short specifically
    for (let ma = 10; ma <= 200; ma += 2) {
        const ema = indicators.ema(closes, ma);
        for (let sl = 0.005; sl <= 0.05; sl += 0.005) {
            const bt = new Backtester({ commission: 0, slippage: 0 });
            const strategyFn = (c, id, i) => {
                if (i < 200) return null;
                const m = ema[i];
                const mPrev = ema[i - 1];
                const curP = closes[i];
                const prevP = closes[i - 1];

                if (!bt.position) {
                    if (curP > m && prevP <= mPrev) return 'BUY';
                    if (curP < m && prevP >= mPrev) return 'SELL';
                } else {
                    if (bt.position.type === 'LONG' && curP < bt.position.entryPrice * (1 - sl)) return 'CLOSE_LONG';
                    if (bt.position.type === 'SHORT' && curP > bt.position.entryPrice * (1 + sl)) return 'CLOSE_SHORT';
                    if (bt.position.type === 'LONG' && curP < m && prevP >= mPrev) return 'SELL';
                    if (bt.position.type === 'SHORT' && curP > m && prevP <= mPrev) return 'BUY';
                }
                return null;
            };
            const result = bt.run(strategyFn, candles);
            if (result.summary.totalReturn > bestLongShort.roi) {
                bestLongShort = { roi: result.summary.totalReturn, ma, sl };
            }
        }
    }
    console.log(`L/S Gold Optimization: ROI ${bestLongShort.roi.toFixed(2)}%, MA ${bestLongShort.ma}, SL ${(bestLongShort.sl * 100).toFixed(1)}%`);
}
optimizeGoldAdvanced();
