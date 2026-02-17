const { getCandleData } = require('./src/engine/dataFetcher');
const indicators = require('./src/engine/indicators');

async function fullOptimize() {
    const symbols = ['ETHUSDT', 'SOLUSDT', 'XAUUSDT'];
    const results = {};

    for (const symbol of symbols) {
        console.log(`Optimizing ${symbol}...`);
        const candles = await getCandleData(symbol, '4h', 180);
        const close = candles.map(c => c.close);

        const indicatorData = { close, ema: {}, rsi: { 14: indicators.rsi(close, 14) } };
        [5, 8, 10, 15, 20, 25, 30, 40, 50, 60, 75, 80, 100, 120, 150, 180, 200, 250].forEach(len => {
            indicatorData.ema[len] = indicators.ema(close, len);
        });

        let best = { roi: -100, params: null };

        const fastLens = [5, 10, 15, 20, 30, 40, 50];
        const slowLens = [40, 50, 60, 75, 80, 100, 150, 200, 250];
        const rsiThreshs = [40, 45, 50, 55, 60];
        const slPcts = [0.01, 0.02, 0.03, 0.04, 0.05];
        const tpPcts = [0, 0.05, 0.10, 0.15, 0.20, 0.25];
        const useRsis = [true, false];

        for (const fl of fastLens) {
            for (const sl of slowLens) {
                if (fl >= sl) continue;
                for (const ur of useRsis) {
                    const rts = ur ? rsiThreshs : [50];
                    for (const rt of rts) {
                        for (const slP of slPcts) {
                            for (const tpP of tpPcts) {
                                let capital = 10000;
                                let pos = null; let entry = 0; let lastSL = -999; let trades = 0;
                                const FEE = 0.0006; // Slippage + Comm

                                for (let i = 1; i < candles.length; i++) {
                                    if (pos === 'LONG') {
                                        if (close[i] <= entry * (1 - slP)) { capital += (close[i] * (1 - FEE) - entry * (1 + FEE)) * (capital / entry); pos = null; lastSL = i; trades++; continue; }
                                        if (tpP > 0 && close[i] >= entry * (1 + tpP)) { capital += (close[i] * (1 - FEE) - entry * (1 + FEE)) * (capital / entry); pos = null; trades++; continue; }
                                    } else if (pos === 'SHORT') {
                                        if (close[i] >= entry * (1 + slP)) { capital += (entry * (1 - FEE) - close[i] * (1 + FEE)) * (capital / entry); pos = null; lastSL = i; trades++; continue; }
                                        if (tpP > 0 && close[i] <= entry * (1 - tpP)) { capital += (entry * (1 - FEE) - close[i] * (1 + FEE)) * (capital / entry); pos = null; trades++; continue; }
                                    }
                                    if (i - lastSL <= 3) continue;

                                    const lC = indicatorData.ema[fl][i - 1] <= indicatorData.ema[sl][i - 1] && indicatorData.ema[fl][i] > indicatorData.ema[sl][i] && (!ur || indicatorData.rsi[14][i] > rt);
                                    const sC = indicatorData.ema[fl][i - 1] >= indicatorData.ema[sl][i - 1] && indicatorData.ema[fl][i] < indicatorData.ema[sl][i] && (!ur || indicatorData.rsi[14][i] < (100 - rt));

                                    if (lC && pos !== 'LONG') {
                                        if (pos === 'SHORT') { capital += (entry * (1 - FEE) - close[i] * (1 + FEE)) * (capital / entry); trades++; }
                                        pos = 'LONG'; entry = close[i];
                                    } else if (sC && pos !== 'SHORT') {
                                        if (pos === 'LONG') { capital += (close[i] * (1 - FEE) - entry * (1 + FEE)) * (capital / entry); trades++; }
                                        pos = 'SHORT'; entry = close[i];
                                    }
                                }
                                const roi = ((capital - 10000) / 10000) * 100;
                                if (roi > best.roi && trades >= 3) {
                                    best = { roi, params: { fl, sl, ur, rt, slP, tpP }, trades };
                                }
                            }
                        }
                    }
                }
            }
        }
        results[symbol] = best;
        console.log(`${symbol} Best: ${best.roi.toFixed(2)}% ROI, Params: ${JSON.stringify(best.params)}`);
    }
    console.log('\nFINAL RESULTS:');
    console.log(JSON.stringify(results, null, 2));
}

fullOptimize();
