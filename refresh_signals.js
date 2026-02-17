require('dotenv').config();
const { getAdminClient } = require('./src/data/database');
const Backtester = require('./src/engine/backtester');
const { getCandles } = require('./src/data/database');
const path = require('path');
const fs = require('fs');

async function refreshAllSignals() {
    console.log('--- STARTING GLOBAL SIGNAL REFRESH ---');
    const supabase = getAdminClient();

    // 1. Fetch all subscriptions
    const { data: subs, error: subsError } = await supabase
        .from('subscriptions')
        .select('*');

    if (subsError) {
        console.error('Error fetching subs:', subsError);
        return;
    }

    console.log(`Found ${subs.length} subscriptions to refresh.`);

    // 2. Load all strategies locally
    const strategyDir = path.join(__dirname, 'src', 'engine', 'strategies');
    const strategies = {};
    fs.readdirSync(strategyDir).forEach(file => {
        if (file.endsWith('.js')) {
            const strat = require(path.join(strategyDir, file));
            strategies[strat.id] = strat;
        }
    });

    for (const sub of subs) {
        const { user_id, strategy_id, symbol, timeframe } = sub;
        const currentSymbol = symbol || 'BTCUSDT';
        const currentTimeframe = timeframe || '4h';

        console.log(`Processing ${strategy_id} for ${currentSymbol} (${currentTimeframe})...`);

        const strat = strategies[strategy_id];
        if (!strat) {
            console.warn(`Strategy ${strategy_id} not found in modules.`);
            continue;
        }

        try {
            // Get candles (ascending order is required by Backtester)
            let candles = await getCandles(currentSymbol, currentTimeframe);
            if (!candles || candles.length < 50) {
                console.warn(`Insufficient data for ${currentSymbol}`);
                continue;
            }
            // REVERSE to Ascending for Backtester
            candles.reverse();

            // Run mini-backtest to get the latest position state
            const bt = new Backtester({ commission: 0, slippage: 0 });
            const result = bt.run(strat.execute, candles);

            const latestName = (strategy_id === 'granville_eth_4h') ? 'Granville Pro' : strat.name;

            if (result && result.recentTrades && result.recentTrades.length > 0) {
                // Get the very last trade or current signal
                const lastEvent = result.recentTrades[0];
                const signalData = {
                    type: lastEvent.type,
                    entryPrice: lastEvent.entryPrice,
                    time: lastEvent.entryTime,
                    strategyId: strategy_id,
                    symbol: currentSymbol
                };

                console.log(`[REFRESH] SubID: ${sub.id} | Asset: ${currentSymbol} | Signal: ${lastEvent.type} @ ${lastEvent.entryPrice} | Name: ${latestName}`);

                await supabase
                    .from('subscriptions')
                    .update({
                        latest_signal: signalData,
                        strategy_name: latestName
                    })
                    .eq('id', sub.id);
            } else {
                console.log(`[REFRESH] SubID: ${sub.id} | No trades for ${currentSymbol}, updating name to ${latestName}`);
                await supabase
                    .from('subscriptions')
                    .update({ strategy_name: latestName })
                    .eq('id', sub.id);
            }
        } catch (err) {
            console.error(`Failed to refresh ${strategy_id}:`, err.message);
        }
    }

    console.log('--- GLOBAL SIGNAL REFRESH COMPLETE ---');
}

refreshAllSignals().catch(console.error);
