// Scan all deployed strategy×symbol×timeframe combos, report ROI, highlight negatives
require('dotenv').config();
const Backtester = require('./src/engine/backtester');
const { getCandleData } = require('./src/engine/dataFetcher');

const strategyModules = [
    require('./src/engine/strategies/ma60'),
    require('./src/engine/strategies/threeStyle'),
    require('./src/engine/strategies/turtleBreakout'),
    require('./src/engine/strategies/dualEma'),
    require('./src/engine/strategies/macdMa'),
    require('./src/engine/strategies/granville_eth_4h'),
    require('./src/engine/strategies/dualSuperTrend'),
    require('./src/engine/strategies/donchianTrend'),
    require('./src/engine/strategies/ichimoku_cloud'),
];

const cryptoSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XAUUSDT'];
const indexSymbols = ['SPXUSDT', 'NQUSDT', 'ESUSDT'];
const allowedGoldStrats = ['three_style', 'granville_eth_4h', 'turtle_breakout', 'dual_st_breakout', 'donchian_trend'];
const indexStratMap = { SPXUSDT: 'turtle_breakout', NQUSDT: 'donchian_trend', ESUSDT: 'granville_eth_4h' };

function buildJobs() {
    const jobs = [];
    for (const s of strategyModules) {
        for (const symbol of cryptoSymbols) {
            if (s.id === 'dual_st_breakout' && symbol === 'XAUUSDT') continue;
            if (symbol === 'XAUUSDT' && s.id === 'three_style') {
                jobs.push({ s, symbol, timeframe: '1h' });
                jobs.push({ s, symbol, timeframe: '4h' });
            } else {
                jobs.push({ s, symbol, timeframe: '4h' });
            }
            if (s.id === 'ichimoku_cloud' && symbol === 'BTCUSDT') {
                jobs.push({ s, symbol, timeframe: '1h' });
            }
        }
        if (allowedGoldStrats.includes(s.id)) {
            if (s.id === 'three_style') {
                jobs.push({ s, symbol: 'PAXGUSDT', timeframe: '1h' });
                jobs.push({ s, symbol: 'PAXGUSDT', timeframe: '4h' });
            } else {
                jobs.push({ s, symbol: 'PAXGUSDT', timeframe: '4h' });
            }
        }
        for (const symbol of indexSymbols) {
            if (s.id === indexStratMap[symbol]) {
                jobs.push({ s, symbol, timeframe: '4h' });
            }
        }
    }
    return jobs;
}

async function run() {
    const jobs = buildJobs();
    const results = [];
    for (const { s, symbol, timeframe } of jobs) {
        try {
            const isIndex = ['SPXUSDT', 'NQUSDT', 'ESUSDT'].includes(symbol);
            const daysBack = isIndex ? 90 : (timeframe === '1h' ? 45 : 180);
            const candles = await getCandleData(symbol, timeframe, { daysBack });
            if (candles.length < 50) { continue; }

            let params = { ...s.defaultParams, symbol, timeframe };
            if (isIndex && s.id === 'turtle_breakout') {
                if (['NQUSDT','NQ'].includes(symbol)) params = { leftBars: 12, rightBars: 4, minHoldBars: 2 };
                else params = { leftBars: 6, rightBars: 5, minHoldBars: 15 };
            }
            const stratFn = s.createStrategy ? s.createStrategy(params) : s.execute;

            const bt = new Backtester({ initialCapital: 10000, positionSize: 0.95, commission: 0, slippage: 0 });
            const res = bt.run(stratFn, candles);
            results.push({
                id: s.id, symbol, timeframe,
                roi: res.summary.totalReturn,
                wr: res.summary.winRate,
                pf: res.summary.profitFactor,
                trades: res.summary.totalTrades,
                mdd: res.summary.maxDrawdown
            });
        } catch (e) {
            results.push({ id: s.id, symbol, timeframe, error: e.message });
        }
    }

    results.sort((a,b) => (a.roi ?? 999) - (b.roi ?? 999));
    console.log('\n=== ALL RESULTS (sorted by ROI asc) ===');
    console.log('ID'.padEnd(22), 'Symbol'.padEnd(10), 'TF'.padEnd(4), 'ROI%'.padStart(8), 'WR%'.padStart(7), 'PF'.padStart(7), 'Trades'.padStart(7), 'MDD%'.padStart(8));
    for (const r of results) {
        if (r.error) { console.log(`${r.id} ${r.symbol} ${r.timeframe} ERR: ${r.error}`); continue; }
        console.log(
            r.id.padEnd(22),
            r.symbol.padEnd(10),
            r.timeframe.padEnd(4),
            r.roi.toFixed(2).padStart(8),
            String(r.wr).padStart(7),
            String(r.pf ?? 'Inf').padStart(7),
            String(r.trades).padStart(7),
            r.mdd.toFixed(2).padStart(8)
        );
    }

    const negatives = results.filter(r => !r.error && r.roi < 0);
    console.log(`\n=== NEGATIVE (${negatives.length}) ===`);
    for (const r of negatives) {
        console.log(`❌ ${r.id} / ${r.symbol} / ${r.timeframe} → ROI ${r.roi.toFixed(2)}%  trades=${r.trades}`);
    }
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
