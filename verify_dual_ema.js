const { createStrategy, OPTIMIZED_PARAMS } = require('./src/engine/strategies/dualEma');
const Backtester = require('./src/engine/backtester');
const { getCandleData } = require('./src/engine/dataFetcher');
const indicators = require('./src/engine/indicators');

async function test() {
    const symbol = 'ETHUSDT';
    const timeframe = '4h';
    const candles = await getCandleData(symbol, timeframe, { daysBack: 180 });

    // Test with Optimized Params
    const opt = {
        symbol,
        timeframe,
        ...OPTIMIZED_PARAMS[symbol]
    };
    console.log('Testing with Params:', opt);

    const strategy = require('./src/engine/strategies/dualEma').createStrategy(opt);

    const backtester = new Backtester({
        initialCapital: 10000,
        positionSize: 0.95,
        commission: 0,
        slippage: 0
    });

    const result = backtester.run(strategy, candles);
    console.log('ROI:', result.summary?.totalReturn);
    console.log('Trades:', result.summary?.totalTrades);
}

test();
