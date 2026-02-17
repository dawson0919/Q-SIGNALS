const Backtester = require('./src/engine/backtester');
const DataFetcher = require('./src/engine/dataFetcher');
const createStrategy = require('./src/engine/strategies/dualSuperTrend');

async function runBenchmark() {
    console.log("Starting Dual SuperTrend Breakout Backtest...");

    const strategy = createStrategy();
    console.log(`Strategy: ${strategy.name}`);
    console.log(`Description: ${strategy.description}`);

    const symbols = ['ETHUSDT', 'SOLUSDT', 'BTCUSDT'];
    const timeframes = ['1h', '4h'];
    const days = 180;

    const allResults = [];

    // Initialize Backtester
    const backtester = new Backtester({ initialCapital: 10000 });

    for (const symbol of symbols) {
        for (const tf of timeframes) {
            console.log(`\n--- Backtesting ${symbol} ${tf} ---`);
            try {
                // Fetch Data
                const candles = await DataFetcher.getCandleData(symbol, tf, days);
                if (candles.length < 200) {
                    console.log(`Not enough data for ${symbol} ${tf}`);
                    continue;
                }

                // Run Backtest - pass strategy.execute function and candles
                const results = backtester.run(strategy.execute, candles);

                const summary = {
                    Symbol: symbol,
                    Timeframe: tf,
                    Trades: results.summary.totalTrades,
                    "Win Rate": results.summary.winRate + '%',
                    "Profit Factor": results.summary.profitFactor,
                    ROI: results.summary.totalReturn + '%',
                    "Net Profit": (results.summary.finalEquity - results.summary.initialCapital).toFixed(2),
                    "Max DD": results.summary.maxDrawdown + '%'
                };
                allResults.push(summary);

            } catch (err) {
                console.error(`Failed to backtest ${symbol} ${tf}:`, err.message);
                console.error(err.stack);
            }
        }
    }

    console.log(JSON.stringify(allResults, null, 2));
}

runBenchmark();
