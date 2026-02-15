// ... (Same as before, but only change the run method)
const { getCandleData } = require('./src/engine/dataFetcher');
const Backtester = require('./src/engine/backtester');

// Load Strategies
const macdMa = require('./src/engine/strategies/macdMa');
const turtle = require('./src/engine/strategies/turtleBreakout');
const threeBlade = require('./src/engine/strategies/threeBlade');
// const dualEma = require('./src/engine/strategies/dualEma');
const ma60 = require('./src/engine/strategies/ma60');

const strategies = {
    [macdMa.id]: macdMa,
    [turtle.id]: turtle,
    [threeBlade.id]: threeBlade,
    // [dualEma.id]: dualEma,
    [ma60.id]: ma60
};

async function run() {
    console.log('Strategy,Symbol,Timeframe,ROI,WinRate,PF,Trades');

    // Define tasks
    const tasks = [
        // BTC
        { id: macdMa.id, symbol: 'BTCUSDT', tf: '4h' },
        { id: turtle.id, symbol: 'BTCUSDT', tf: '4h' },
        { id: ma60.id, symbol: 'BTCUSDT', tf: '4h' },

        // ETH
        { id: macdMa.id, symbol: 'ETHUSDT', tf: '4h' },

        // GOLD
        { id: turtle.id, symbol: 'XAUUSDT', tf: '4h' },
        { id: turtle.id, symbol: 'XAUUSDT', tf: '1h' },
        { id: threeBlade.id, symbol: 'XAUUSDT', tf: '4h' },
        { id: threeBlade.id, symbol: 'XAUUSDT', tf: '1h' }
    ];

    for (const task of tasks) {
        try {
            const candles = await getCandleData(task.symbol, task.tf);
            const stratModule = strategies[task.id];

            // Create Strategy Function
            let stratFn;
            if (stratModule.createStrategy) {
                stratFn = stratModule.createStrategy({
                    ...stratModule.defaultParams,
                    symbol: task.symbol,
                    timeframe: task.tf
                });
            } else {
                stratFn = stratModule.execute;
            }

            // Zero commission backtest
            const bt = new Backtester({
                initialCapital: 10000,
                positionSize: 0.95,
                commission: 0,
                slippage: 0
            });

            const res = bt.run(stratFn, candles);

            const roi = res.summary.totalReturn.toFixed(2);
            const wr = res.summary.winRate;
            let pf = res.summary.profitFactor;
            if (pf === null) pf = 'Infinity';
            else pf = pf.toFixed(2);

            console.log(`${stratModule.name.split('(')[0]},${task.symbol},${task.tf},${roi}%,${wr}%,${pf},${res.summary.totalTrades}`);

        } catch (e) {
            console.error(`Error processing ${task.symbol} ${task.tf}:`, e.message);
        }
    }
}

run();
