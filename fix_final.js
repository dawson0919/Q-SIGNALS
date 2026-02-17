
require('dotenv').config();
const { getAdminClient, getCandles } = require('./src/data/database');
const Backtester = require('./src/engine/backtester');
const granville = require('./src/engine/strategies/granville_eth_4h');

async function fixAll() {
    const supabase = getAdminClient();
    const { data: subs } = await supabase.from('subscriptions').select('*');

    console.log(`Scanning ${subs.length} total subscriptions...`);

    for (const sub of subs) {
        if (sub.strategy_id === 'granville_eth_4h' || sub.strategy_name?.includes('Granville')) {
            const sym = sub.symbol || 'BTCUSDT';
            console.log(`Fixing SubID ${sub.id} (${sym})...`);

            const candles = await getCandles(sym, '4h');
            if (!candles || candles.length < 50) continue;
            candles.reverse();

            const result = new Backtester({ commission: 0, slippage: 0 }).run(granville.execute, candles);
            if (result.recentTrades && result.recentTrades[0]) {
                const tr = result.recentTrades[0];
                const cleanPrice = Number(tr.entryPrice);
                console.log(` -> Setting price to ${cleanPrice} (${tr.type})`);

                await supabase.from('subscriptions').update({
                    strategy_name: 'Granville Pro',
                    latest_signal: {
                        type: tr.type,
                        entryPrice: cleanPrice,
                        time: tr.entryTime,
                        symbol: sym,
                        strategyId: 'granville_eth_4h'
                    }
                }).eq('id', sub.id);
            }
        }
    }
}
fixAll();
