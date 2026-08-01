// 1) 驗證新參數(生產路徑:createStrategy({...defaultParams, symbol, timeframe}))
// 2) 指數 SPX/NQ/ES:9 支策略現況對決,找正報酬
const { fetchKlines } = require('../src/data/backfill');
const Backtester = require('../src/engine/backtester');
const S = (n) => require('../src/engine/strategies/' + n);
const mods = {
  ma60: S('ma60'), dual_ema: S('dualEma'), three_style: S('threeStyle'),
  turtle_breakout: S('turtleBreakout'), macd_ma_optimized: S('macdMa'),
  granville_eth_4h: S('granville_eth_4h'), dual_st_breakout: S('dualSuperTrend'),
  donchian_trend: S('donchianTrend'), ichimoku_cloud: S('ichimoku_cloud'),
};

async function getCandles(symbol, timeframe, daysBack) {
  const end = Date.now(), start = end - daysBack * 86400000;
  const ivMs = (timeframe === '4h' ? 4 : 1) * 3600000;
  let out = [], cur = start;
  for (let i = 0; i < 15 && cur < end; i++) {
    const batch = await fetchKlines(symbol, timeframe, cur, end, 1000);
    if (!batch || !batch.length) break;
    out = out.concat(batch);
    const lastT = batch[batch.length - 1].openTime ?? batch[batch.length - 1].open_time;
    if (batch.length < 900) break;
    cur = lastT + ivMs;
  }
  const seen = new Set();
  out = out.filter(c => { const t = c.openTime ?? c.open_time; if (seen.has(t)) return false; seen.add(t); return true; });
  out.sort((a, b) => (a.openTime ?? a.open_time) - (b.openTime ?? b.open_time));
  return out;
}

function run(mod, symbol, timeframe, candles) {
  const params = { ...(mod.defaultParams ?? {}), symbol, timeframe };
  const fn = mod.createStrategy ? mod.createStrategy(params) : mod.execute;
  const b = new Backtester({ initialCapital: 10000, positionSize: 0.95, commission: 0, slippage: 0 });
  const r = b.run(fn, candles);
  return r?.summary ? { roi: r.summary.totalReturn, wr: r.summary.winRate, pf: r.summary.profitFactor, n: r.summary.totalTrades } : null;
}

(async () => {
  const origLog = console.log; console.log = () => {}; // 靜音策略 Init 噪音
  const out = [];
  const log = (m) => out.push(m);

  // 1) 驗證新參數
  const verify = [
    ['ETHUSDT', 'dual_ema', '4h', 180], ['SOLUSDT', 'dual_ema', '4h', 180],
    ['XAUUSDT', 'dual_ema', '4h', 180], ['PAXGUSDT', 'dual_ema', '4h', 180],
    ['BTCUSDT', 'turtle_breakout', '4h', 180], ['PAXGUSDT', 'turtle_breakout', '4h', 180],
  ];
  log('===== 新參數驗證(生產路徑)=====');
  for (const [symbol, sid, tf, days] of verify) {
    const candles = await getCandles(symbol, tf, days);
    const full = run(mods[sid], symbol, tf, candles);
    const cut = Math.floor(candles.length * 0.7);
    const validSeg = candles.slice(Math.max(0, cut - 260));
    const valid = run(mods[sid], symbol, tf, validSeg);
    log(`${sid}_${symbol}_${tf}: 全窗 ${full?.roi}%(WR ${full?.wr}% PF ${full?.pf} N ${full?.n})| 近30%段 ${valid?.roi}%`);
  }

  // 2) 指數對決
  log('===== 指數 9 策略對決 =====');
  for (const symbol of ['SPXUSDT', 'NQUSDT', 'ESUSDT']) {
    const candles = await getCandles(symbol, '4h', 90);
    log(`--- ${symbol}(${candles.length} 根)---`);
    const rows = [];
    for (const [sid, mod] of Object.entries(mods)) {
      try {
        const r = run(mod, symbol, '4h', candles);
        if (r) rows.push({ sid, ...r });
      } catch (e) { /* skip */ }
    }
    rows.sort((a, b) => b.roi - a.roi);
    for (const r of rows) log(`  ${r.sid}: ${r.roi}%(WR ${r.wr}% PF ${r.pf} N ${r.n})`);
  }
  console.log = origLog;
  console.log(out.join('\n'));
})();
