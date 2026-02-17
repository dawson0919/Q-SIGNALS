
const Backtester = require('./src/engine/backtester');
const strategy = require('./src/engine/strategies/granville_eth_4h');
const { getCandles } = require('./src/data/database');
require('dotenv').config();

async function runBenchmark(symbol) {
    console.log(`\n[Benchmark] Testing ${symbol}...`);
    const candles = await getCandles(symbol, '4h');

    if (!candles || candles.length === 0) {
        console.error(`No data for ${symbol}`);
        return;
    }

    // Last 1200 bars (~200 days)
    const testData = candles.slice(-1200);
    console.log(`Data points: ${testData.length}`);

    const bt = new Backtester({
        initialCapital: 10000,
        positionSize: 1,
        commission: 0,
        slippage: 0
    });

    try {
        const result = bt.run(strategy.execute, testData);

        if (result.error) {
            console.error(`Backtest Error for ${symbol}:`, result.error);
            return;
        }

        if (!result.summary) {
            console.error(`No summary for ${symbol}`);
            return;
        }

        console.log(`----------------------------------------`);
        console.log(`Symbol: ${symbol} (${testData.length} bars)`);
        console.log(`Total ROI: ${result.summary.totalReturn.toFixed(2)}%`);
        console.log(`Win Rate: ${result.summary.winRate}%`);
        console.log(`Profit Factor: ${result.summary.profitFactor}`);
        console.log(`Total Trades: ${result.summary.totalTrades}`);
        console.log(`Max Drawdown: ${result.summary.maxDrawdown.toFixed(2)}%`);
        console.log(`----------------------------------------`);
    } catch (e) {
        console.error(`Execution failed for ${symbol}:`, e.message);
    }
}

async function main() {
    try {
        await runBenchmark('BTCUSDT');
        await runBenchmark('ETHUSDT');
        await runBenchmark('SOLUSDT');
    } catch (err) {
        console.error('Main failed:', err);
    }
}

main();
