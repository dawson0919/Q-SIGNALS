const { getCandleData } = require('./src/engine/dataFetcher');
const { createStrategy } = require('./src/engine/strategies/turtleBreakout');
const Backtester = require('./src/engine/backtester');
require('dotenv').config();

async function test() {
    const symbol = 'SPXUSDT';
    const timeframe = '4h';
    const candles = await getCandleData(symbol, timeframe, { daysBack: 180 });
    console.log(`Fetched ${candles.length} candles`);
    if (candles.length > 0) {
        console.log('Sample candle:', JSON.stringify(candles[candles.length - 1]));
    }

    const strat = createStrategy({ symbol, timeframe });
    const backtester = new Backtester();
    const report = backtester.run(strat, candles);

    console.log('Summary:', JSON.stringify(report.summary));
    if (report.recentTrades.length > 0) {
        console.log('Latest Trade:', JSON.stringify(report.recentTrades[0]));
    } else {
        console.log('No trades found');
    }
}

test();
