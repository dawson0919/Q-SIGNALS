const Backtester = require('./src/engine/backtester');
const meanReversion = require('./src/engine/strategies/meanReversion');
const { getCandleData } = require('./src/engine/dataFetcher');

async function runBenchmark() {
    console.log('Starting Mean Reversion Backtest...');
    console.log('Strategy:', meanReversion.name);
    console.log('Description:', meanReversion.description);

    const symbols = ['ETHUSDT', 'SOLUSDT', 'BTCUSDT'];
    const timeframes = ['1h', '4h'];

    // Create new backtester instance
    const backtester = new Backtester({
        initialCapital: 10000,
        positionSize: 1, // 100%
        commission: 0.001, // 0.1% per trade
        slippage: 0.0005   // 0.05% slippage
    });

    for (const symbol of symbols) {
        for (const tf of timeframes) {
            console.log(`\n--- Backtesting ${symbol} ${tf} ---`);
            try {
                // Fetch Data (180 days)
                const candles = await getCandleData(symbol, tf, { daysBack: 180 });
                if (!candles || candles.length < 100) {
                    console.log(`Insufficient data for ${symbol} ${tf}`);
                    continue;
                }

                // Run Strategy
                const results = backtester.run(meanReversion.execute, candles);

                if (results.error) {
                    console.error('Error:', results.error);
                    continue;
                }

                const summary = {
                    Symbol: symbol,
                    Timeframe: tf,
                    Trades: results.summary.totalTrades,
                    "Win Rate": results.summary.winRate + '%',
                    "Profit Factor": results.summary.profitFactor,
                    ROI: results.summary.totalReturn + '%',
                    "Net Profit": (results.summary.finalEquity - results.summary.initialCapital).toFixed(2)
                };
                allResults.push(summary);

            } catch (err) {
                console.error(`Failed to backtest ${symbol} ${tf}:`, err.message);
            }
        }
    }

    console.log(JSON.stringify(allResults, null, 2));
}

const allResults = [];
runBenchmark();
