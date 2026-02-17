
require('dotenv').config();
const { getAdminClient, getCandles } = require('./src/data/database');
const Backtester = require('./src/engine/backtester');
const granville = require('./src/engine/strategies/granville_eth_4h');

async function fixGranville() {
    const supabase = getAdminClient();
    console.log("Fixing Granville Pro Signals...");

    const { data: subs, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('strategy_id', 'granville_eth_4h');

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Found ${subs.length} Granville Pro subscriptions.`);

    for (const sub of subs) {
        const symbol = sub.symbol || 'BTCUSDT';
        console.log(`\n--- Processing Sub ${sub.id} (${symbol}) ---`);

        try {
            const candles = await getCandles(symbol, '4h');
            if (!candles || candles.length < 100) {
                console.warn(`Insufficient data for ${symbol}`);
                continue;
            }
            candles.reverse(); // Ascending

            const bt = new Backtester({ commission: 0, slippage: 0 });
            const result = bt.run(granville.execute, candles);

            if (result && result.recentTrades && result.recentTrades.length > 0) {
                const lastEvent = result.recentTrades[0];
                const signalData = {
                    type: lastEvent.type,
                    entryPrice: Number(lastEvent.entryPrice),
                    time: lastEvent.entryTime,
                    strategyId: 'granville_eth_4h',
                    symbol: symbol
                };

                console.log(`UPDATING: ${symbol} -> ${lastEvent.type} at $${lastEvent.entryPrice.toFixed(2)}`);

                const { error: upError } = await supabase
                    .from('subscriptions')
                    .update({
                        latest_signal: signalData,
                        strategy_name: 'Granville Pro'
                    })
                    .eq('id', sub.id);

                if (upError) console.error("Update Error:", upError.message);
                else console.log("✅ Success");
            } else {
                console.log("No trades found for this period.");
                // Still update the name
                await supabase.from('subscriptions').update({ strategy_name: 'Granville Pro' }).eq('id', sub.id);
            }
        } catch (e) {
            console.error(`Error processing ${symbol}:`, e.message);
        }
    }
}

fixGranville();
