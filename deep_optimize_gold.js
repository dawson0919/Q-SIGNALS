const { getCandleData } = require('./src/engine/dataFetcher');
const Backtester = require('./src/engine/backtester');
const indicators = require('./src/engine/indicators');

// Logic for Dual EMA with flexible RSI and SL
function createFlexibleStrategy(params = {}) {
    const { fastLen, slowLen, rsiLen, rsiThresh, slPct, tpPct, cooldown, useRsi } = params;

    let position = null;
    let entryPrice = 0;
    let lastSLBar = -999;

    return function execute(candles, indicatorData, i, ind) {
        const close = indicatorData.close;
        const fastEma = indicatorData.ema[fastLen];
        const slowEma = indicatorData.ema[slowLen];
        const rsi = useRsi ? indicatorData.rsi[rsiLen] : null;

        if (!fastEma || !slowEma || !fastEma[i] || !slowEma[i]) return null;
        if (useRsi && (!rsi || !rsi[i])) return null;

        // 1. Exit Logic (SL/TP)
        if (position === 'LONG') {
            if (close[i] <= entryPrice * (1 - slPct)) {
                position = null; lastSLBar = i; return 'CLOSE_LONG';
            }
            if (tpPct && close[i] >= entryPrice * (1 + tpPct)) {
                position = null; return 'CLOSE_LONG';
            }
        } else if (position === 'SHORT') {
            if (close[i] >= entryPrice * (1 + slPct)) {
                position = null; lastSLBar = i; return 'CLOSE_SHORT';
            }
            if (tpPct && close[i] <= entryPrice * (1 - tpPct)) {
                position = null; return 'CLOSE_SHORT';
            }
        }

        // 2. Cooldown
        if (i - lastSLBar <= cooldown) return null;

        // 3. Entry Logic
        const longCond = fastEma[i - 1] <= slowEma[i - 1] && fastEma[i] > slowEma[i] && (!useRsi || rsi[i] > rsiThresh);
        const shortCond = fastEma[i - 1] >= slowEma[i - 1] && fastEma[i] < slowEma[i] && (!useRsi || rsi[i] < (100 - rsiThresh));

        if (longCond) { position = 'LONG'; entryPrice = close[i]; return 'BUY'; }
        if (shortCond) { position = 'SHORT'; entryPrice = close[i]; return 'SELL'; }

        return null;
    };
}

async function startDeepOptimization() {
    const symbol = 'XAUUSDT';
    const timeframe = '4h';
    const days = 180;

    console.log(`Deep Optimizing ${symbol} ${timeframe}... Goal: ROI > 20%`);

    const candles = await getCandleData(symbol, timeframe, days);
    const backtester = new Backtester({ initialCapital: 10000, commission: 0.0006, slippage: 0.0005 });

    const GRID = {
        fastLen: [10, 20, 30, 40, 50],
        slowLen: [60, 80, 100, 120, 150, 200],
        rsiLen: [14],
        rsiThresh: [40, 45, 50, 55, 60],
        slPct: [0.015, 0.02, 0.03, 0.04, 0.05],
        tpPct: [0, 0.05, 0.10, 0.15], // Test Take Profit too
        cooldown: [3, 5, 8],
        useRsi: [true, false]
    };

    let best = { roi: -Infinity, params: null };

    for (const fl of GRID.fastLen) {
        for (const sl of GRID.slowLen) {
            if (fl >= sl) continue;
            for (const rsiT of GRID.rsiThresh) {
                for (const slP of GRID.slPct) {
                    for (const tpP of GRID.tpPct) {
                        for (const cd of GRID.cooldown) {
                            for (const ur of GRID.useRsi) {
                                const params = { fastLen: fl, slowLen: sl, rsiLen: 14, rsiThresh: rsiT, slPct: slP, tpPct: tpP, cooldown: cd, useRsi: ur };
                                const strategy = createFlexibleStrategy(params);

                                const executeWrapper = (c, data, i, ind) => {
                                    if (!data.ema[params.fastLen]) data.ema[params.fastLen] = indicators.ema(data.close, params.fastLen);
                                    if (!data.ema[params.slowLen]) data.ema[params.slowLen] = indicators.ema(data.close, params.slowLen);
                                    if (params.useRsi && !data.rsi[14]) data.rsi[14] = indicators.rsi(data.close, 14);
                                    return strategy(c, data, i, ind);
                                };

                                const report = backtester.run(executeWrapper, candles);
                                if (report.summary && report.summary.totalReturn > best.roi) {
                                    if (report.summary.totalTrades >= 3) {
                                        best = { roi: report.summary.totalReturn, params, summary: report.summary };
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    console.log(`\nFinal Results for ${symbol}:`);
    console.log(`Best ROI: ${best.roi}%`);
    console.log(`Winner Params: ${JSON.stringify(best.params, null, 2)}`);
}

startDeepOptimization();
