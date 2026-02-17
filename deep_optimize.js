
const { Backtester } = require('./src/engine/backtester');
const indicators = require('./src/engine/indicators');
const { getCandles } = require('./src/data/database');
require('dotenv').config();

async function optimize(symbol) {
    console.log(`Optimizing ${symbol}...`);
    const candles = await getCandles(symbol, '4h');
    if (!candles || candles.length < 300) return;

    // Use last 180 days to match frontend display
    const bars = candles.slice(-1000);

    let best = { roi: -999, ma: 0 };
    const closes = bars.map(c => Number(c.close));

    for (let ma = 20; ma <= 150; ma += 5) {
        const ema = indicators.ema(closes, ma);
        const bt = new Backtester({ commission: 0.0004, slippage: 0.0002 }); // Professional fees

        const strategyFn = (c, id, i) => {
            if (closes[i] > ema[i] && closes[i - 1] <= ema[i - 1]) return 'BUY';
            if (closes[i] < ema[i] && closes[i - 1] >= ema[i - 1]) return 'SELL';
            return null;
        };

        const result = bt.run(strategyFn, bars);
        if (result.summary.totalReturn > best.roi) {
            best = { roi: result.summary.totalReturn, ma };
        }
    }
    console.log(`Result for ${symbol}: ROI ${best.roi.toFixed(2)}% | MA ${best.ma}`);
    return best;
}

async function run() {
    await optimize('ETHUSDT');
    await optimize('BTCUSDT');
    await optimize('SOLUSDT');
}
run();
