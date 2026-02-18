
const Backtester = require('./src/engine/backtester');
const { getCandleData } = require('./src/engine/dataFetcher');
const strategies = {
    ma60: require('./src/engine/strategies/ma60'),
    threeBlade: require('./src/engine/strategies/threeStyle'),
    turtleBreakout: require('./src/engine/strategies/turtleBreakout'),
    dualEma: require('./src/engine/strategies/dualEma'),
    macdMa: require('./src/engine/strategies/macdMa')
};

(async () => {
    const candles = await getCandleData('NASUSDT', '1h', { daysBack: 90 });
    const backtester = new Backtester({ initialCapital: 10000 });
    const results = [];
    for (const [id, s] of Object.entries(strategies)) {
        if (id === 'turtleBreakout') {
            for (let left of [4, 8, 12, 16, 20, 24]) {
                for (let hold of [2, 5, 10, 20, 40]) {
                    const strategyFn = s.createStrategy({ leftBars: left, rightBars: 2, minHoldBars: hold, symbol: 'NASUSDT', timeframe: '1h' });
                    const report = backtester.run(strategyFn, candles);
                    results.push({ id, ret: report.summary.totalReturn, params: { left, hold } });
                }
            }
        } else {
            const strategyFn = s.createStrategy ? s.createStrategy({ symbol: 'NASUSDT', timeframe: '1h' }) : s.execute;
            const report = backtester.run(strategyFn, candles);
            results.push({ id, ret: report.summary.totalReturn, params: null });
        }
    }
    results.sort((a, b) => b.ret - a.ret);
    console.log('BEST_STRATEGY_START');
    console.log(JSON.stringify(results[0]));
    console.log('BEST_STRATEGY_END');
})();
