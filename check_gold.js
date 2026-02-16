
const Backtester = require('./src/engine/backtester');
const { getCandleData } = require('./src/engine/dataFetcher');
const strategy = require('./src/engine/strategies/turtleBreakout');

(async () => {
    console.log('--- XAUUSDT Optimization ---');
    const symbol = 'XAUUSDT';
    const backtester = new Backtester({ initialCapital: 10000 });

    for (let tf of ['1h', '4h']) {
        const days = tf === '1h' ? 45 : 180;
        const candles = await getCandleData(symbol, tf, { daysBack: days });
        const params = { symbol, timeframe: tf };
        const strategyFn = strategy.createStrategy(params);
        const report = backtester.run(strategyFn, candles);
        console.log(`${tf} (${days}d): Return: ${report.summary.totalReturn}% | Trades: ${report.summary.totalTrades}`);
    }
})();
