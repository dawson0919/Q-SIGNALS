require('dotenv').config();
const Backtester = require('./src/engine/backtester');
const { getCandleData } = require('./src/engine/dataFetcher');

// Load strategies
const strategies = [
    require('./src/engine/strategies/ma60'),
    require('./src/engine/strategies/dualEma'),
    require('./src/engine/strategies/threeStyle'),
    require('./src/engine/strategies/turtleBreakout'),
    require('./src/engine/strategies/macdMa'),
    require('./src/engine/strategies/granville_eth_4h'),
    require('./src/engine/strategies/dualSuperTrend'),
    require('./src/engine/strategies/donchianTrend')
];

async function benchmarkPAXG() {
    const symbol = 'PAXGUSDT';
    const timeframe = '4h';
    console.log(`\n=== Benchmarking ${symbol} ${timeframe} ===`);

    const candles = await getCandleData(symbol, timeframe, { daysBack: 180 });
    if (!candles || candles.length < 100) {
        console.error(`Insufficient data for ${symbol}. Found ${candles?.length || 0} candles.`);
        process.exit(1);
    }
    console.log(`Loaded ${candles.length} candles.\n`);

    const results = [];

    for (const s of strategies) {
        try {
            const bt = new Backtester({ initialCapital: 10000 });
            const params = { ...s.defaultParams, symbol, timeframe };
            const strategyFn = s.createStrategy ? s.createStrategy(params) : s.execute;

            const res = bt.run(strategyFn, candles);
            results.push({
                name: s.name,
                roi: res.summary.totalReturn,
                winRate: res.summary.winRate,
                profitFactor: res.summary.profitFactor,
                trades: res.summary.totalTrades
            });
        } catch (err) {
            console.error(`Error testing ${s.name}:`, err.message);
        }
    }

    // Sort by ROI descending
    results.sort((a, b) => b.roi - a.roi);

    console.log('--- Results (Sorted by ROI) ---');
    results.forEach(r => {
        console.log(`${r.name.padEnd(25)} | ROI: ${(r.roi.toFixed(2) + '%').padEnd(8)} | WinRate: ${(r.winRate.toFixed(2) + '%').padEnd(8)} | PF: ${(r.profitFactor || 0).toFixed(2).padEnd(5)} | Trades: ${r.trades}`);
    });

    const fs = require('fs');
    fs.writeFileSync('benchmark_results.json', JSON.stringify(results, null, 2));
    console.log('\nResults saved to benchmark_results.json');

    process.exit(0);
}

benchmarkPAXG();
