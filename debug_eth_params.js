const { getCandleData } = require('./src/engine/dataFetcher');
const indicators = require('./src/engine/indicators');

async function checkParams() {
    const symbol = 'ETHUSDT';
    const timeframe = '4h';
    const candles = await getCandleData(symbol, timeframe, 180);
    const close = candles.map(c => c.close);

    const fl = 20; const sl = 200; const ur = true; const rsiT = 50; const slP = 0.03; const tpP = 0.0; const cd = 3;

    const rsi = indicators.rsi(close, 14);
    const fastEma = indicators.ema(close, fl);
    const slowEma = indicators.ema(close, sl);

    let capital = 10000;
    let pos = null;
    let entry = 0;
    let lastSL = -999;
    let tradesCount = 0;

    // Simulating fees like in optimize script (0.05% per side)
    const FEE = 0.0005;

    for (let i = 1; i < candles.length; i++) {
        if (pos === 'LONG') {
            if (close[i] <= entry * (1 - slP)) {
                capital += (close[i] * (1 - FEE) - entry * (1 + FEE)) * (capital / entry);
                pos = null; lastSL = i; tradesCount++; continue;
            }
        } else if (pos === 'SHORT') {
            if (close[i] >= entry * (1 + slP)) {
                capital += (entry * (1 - FEE) - close[i] * (1 + FEE)) * (capital / entry);
                pos = null; lastSL = i; tradesCount++; continue;
            }
        }
        if (i - lastSL <= cd) continue;

        const lC = fastEma[i - 1] <= slowEma[i - 1] && fastEma[i] > slowEma[i] && (!ur || rsi[i] > rsiT);
        const sC = fastEma[i - 1] >= slowEma[i - 1] && fastEma[i] < slowEma[i] && (!ur || rsi[i] < (100 - rsiT));

        if (lC && pos !== 'LONG') {
            if (pos === 'SHORT') { capital += (entry * (1 - FEE) - close[i] * (1 + FEE)) * (capital / entry); tradesCount++; }
            pos = 'LONG'; entry = close[i];
        } else if (sC && pos !== 'SHORT') {
            if (pos === 'LONG') { capital += (close[i] * (1 - FEE) - entry * (1 + FEE)) * (capital / entry); tradesCount++; }
            pos = 'SHORT'; entry = close[i];
        }
    }
    console.log(`ROI: ${((capital - 10000) / 100).toFixed(2)}%, Trades: ${tradesCount}`);
}
checkParams();
