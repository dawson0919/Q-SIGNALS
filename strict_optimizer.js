
const Backtester = require('./src/engine/backtester');
const indicators = require('./src/engine/indicators');
const { getCandles } = require('./src/data/database');
require('dotenv').config();

async function optimizeFor180d(symbol) {
    console.log(`Optimizing ${symbol} for strictly last 180 days...`);
    const allCandles = await getCandles(symbol, '4h');
    // 180 days = 180 * 6 = 1080 bars. 
    // We fetch 1280 to allow 200 bars of "warm-up" for indicators
    const candles = allCandles.slice(-1280);
    const closes = candles.map(c => Number(c.close));

    let best = { roi: -999, ma: 0, sl: 0 };

    // Grid search for MA (40-150) and SL (4%-10%)
    for (let ma = 40; ma <= 140; ma += 5) {
        for (let sl = 0.04; sl <= 0.10; sl += 0.01) {
            const ema = indicators.ema(closes, ma);
            const bt = new Backtester({ commission: 0, slippage: 0 });

            // We only calculate ROI on the LAST 1080 bars
            const strategyFn = (c, id, i) => {
                if (i < candles.length - 1080) return null; // Warm up
                if (closes[i] > ema[i] && closes[i - 1] <= ema[i - 1]) return 'BUY';
                if (closes[i] < ema[i] && closes[i - 1] >= ema[i - 1]) return 'SELL';
                // Internal SL
                if (bt.position && bt.position.type === 'LONG' && closes[i] < bt.position.entryPrice * (1 - sl)) return 'CLOSE_LONG';
                if (bt.position && bt.position.type === 'SHORT' && closes[i] > bt.position.entryPrice * (1 + sl)) return 'CLOSE_SHORT';
                return null;
            };

            const result = bt.run(strategyFn, candles);
            if (result.summary.totalReturn > best.roi) {
                best = { roi: result.summary.totalReturn, ma, sl };
            }
        }
    }
    console.log(`[${symbol}] Best ROI: ${best.roi.toFixed(2)}% | MA: ${best.ma} | SL: ${(best.sl * 100).toFixed(0)}%`);
    return best;
}

async function run() {
    const eth = await optimizeFor180d('ETHUSDT');
    const btc = await optimizeFor180d('BTCUSDT');
    const sol = await optimizeFor180d('SOLUSDT');

    console.log("\n--- Final Recommendations ---");
    console.log(`ETH: MA ${eth.ma}, SL ${eth.sl}`);
    console.log(`BTC: MA ${btc.ma}, SL ${btc.sl}`);
    console.log(`SOL: MA ${sol.ma}, SL ${sol.sl}`);
}
run();
