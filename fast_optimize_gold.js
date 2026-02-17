const { getCandleData } = require('./src/engine/dataFetcher');
const Backtester = require('./src/engine/backtester');
const indicators = require('./src/engine/indicators');

async function reallyFastOptimize() {
    const symbol = 'ETHUSDT';
    const timeframe = '4h';
    const days = 180;
    const candles = await getCandleData(symbol, timeframe, days);
    const close = candles.map(c => c.close);

    console.log(`Searching for best Gold params...`);

    const indicatorData = { close, ema: {}, rsi: { 14: indicators.rsi(close, 14) } };
    [5, 10, 15, 20, 30, 40, 50, 60, 80, 100, 120, 150, 180, 200].forEach(len => {
        indicatorData.ema[len] = indicators.ema(close, len);
    });

    let best = { roi: -100, params: null };

    const GRID = {
        fastLen: [5, 10, 15, 20, 30, 40],
        slowLen: [40, 50, 60, 80, 100, 150, 200],
        rsiThresh: [40, 45, 50, 55, 60],
        slPct: [0.01, 0.015, 0.02, 0.03, 0.05],
        tpPct: [0, 0.05, 0.10, 0.15, 0.20, 0.25],
        cooldown: [3, 5, 8],
        useRsi: [true, false]
    };

    for (const fl of GRID.fastLen) {
        for (const sl of GRID.slowLen) {
            if (fl >= sl) continue;
            for (const ur of GRID.useRsi) {
                const rsiTs = ur ? GRID.rsiThresh : [50];
                for (const rsiT of rsiTs) {
                    for (const slP of GRID.slPct) {
                        for (const tpP of GRID.tpPct) {
                            for (const cd of GRID.cooldown) {
                                let capital = 10000;
                                let pos = null;
                                let entry = 0;
                                let lastSL = -999;
                                let tradesCount = 0;

                                for (let i = 1; i < candles.length; i++) {
                                    if (pos === 'LONG') {
                                        if (close[i] <= entry * (1 - slP)) { capital += (close[i] * 0.9995 - entry * 1.0005) * (capital / entry); pos = null; lastSL = i; tradesCount++; continue; }
                                        if (tpP > 0 && close[i] >= entry * (1 + tpP)) { capital += (close[i] * 0.9995 - entry * 1.0005) * (capital / entry); pos = null; tradesCount++; continue; }
                                    } else if (pos === 'SHORT') {
                                        if (close[i] >= entry * (1 + slP)) { capital += (entry * 0.9995 - close[i] * 1.0005) * (capital / entry); pos = null; lastSL = i; tradesCount++; continue; }
                                        if (tpP > 0 && close[i] <= entry * (1 - tpP)) { capital += (entry * 0.9995 - close[i] * 1.0005) * (capital / entry); pos = null; tradesCount++; continue; }
                                    }
                                    if (i - lastSL <= cd) continue;

                                    const lC = indicatorData.ema[fl][i - 1] <= indicatorData.ema[sl][i - 1] && indicatorData.ema[fl][i] > indicatorData.ema[sl][i] && (!ur || indicatorData.rsi[14][i] > rsiT);
                                    const sC = indicatorData.ema[fl][i - 1] >= indicatorData.ema[sl][i - 1] && indicatorData.ema[fl][i] < indicatorData.ema[sl][i] && (!ur || indicatorData.rsi[14][i] < (100 - rsiT));

                                    if (lC && pos !== 'LONG') {
                                        if (pos === 'SHORT') { capital += (entry * 0.9995 - close[i] * 1.0005) * (capital / entry); tradesCount++; }
                                        pos = 'LONG'; entry = close[i];
                                    } else if (sC && pos !== 'SHORT') {
                                        if (pos === 'LONG') { capital += (close[i] * 0.9995 - entry * 1.0005) * (capital / entry); tradesCount++; }
                                        pos = 'SHORT'; entry = close[i];
                                    }
                                }
                                const roi = ((capital - 10000) / 10000) * 100;
                                if (roi > best.roi && tradesCount >= 3) {
                                    best = { roi, params: { fl, sl, ur, rsiT, slP, tpP, cd } };
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    console.log(`Best Gold ROI: ${best.roi.toFixed(2)}%`);
    console.log(`Params: ${JSON.stringify(best.params, null, 2)}`);
}

reallyFastOptimize();
