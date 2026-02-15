// Premium Strategy: Dual EMA 4H Optimized v2
// EMA 50/200 + RSI Filter (14) + 5% SL + 3-Bar Cooldown

const pineScript = `
//@version=5
strategy("Dual EMA 4H Optimized v2", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=100, commission_type=strategy.commission.percent, commission_value=0.06, initial_capital=100, pyramiding=0)

// --- MA Settings ---
fast_len      = input.int(50,    "Fast EMA Period")
slow_len      = input.int(200,   "Slow EMA Period")

// --- RSI Filter ---
use_rsi_filter = input.bool(true,  "Enable RSI Filter")
rsi_len        = input.int(14,     "RSI Period")

// --- Risk Management ---
sl_pct         = input.float(5.0,  "Stop Loss %")
cooldown_bars  = input.int(3,      "Cooldown Bars After SL")

fast_ema = ta.ema(close, fast_len)
slow_ema = ta.ema(close, slow_len)
rsi_val  = ta.rsi(close, rsi_len)

longCondition  = ta.crossover(fast_ema, slow_ema) and (not use_rsi_filter or rsi_val > 50)
shortCondition = ta.crossunder(fast_ema, slow_ema) and (not use_rsi_filter or rsi_val < 50)

if (longCondition)
    strategy.entry("Long", strategy.long)

if (shortCondition)
    strategy.entry("Short", strategy.short)

// Stop Loss logic (simplified for Pine representation)
strategy.exit("SL", "Long", stop=strategy.position_avg_price * (1 - sl_pct/100))
strategy.exit("SL", "Short", stop=strategy.position_avg_price * (1 + sl_pct/100))
`.trim();

const FAST_LEN = 50;
const SLOW_LEN = 200;
const RSI_LEN = 14;
const SL_PCT = 0.05; // 5%
const COOLDOWN_BARS = 3;

function createStrategy(params = {}) {
    let fast_len = params.fastLen || FAST_LEN;
    let slow_len = params.slowLen || SLOW_LEN;
    let rsi_len = params.rsiLen || RSI_LEN;
    let sl_pct = params.slPct || SL_PCT;
    let cooldown = params.cooldown || COOLDOWN_BARS;

    // Apply Optimized Parameters for Gold 4h
    if (params.symbol === 'XAUUSDT' && params.timeframe === '4h') {
        fast_len = 30; slow_len = 100; sl_pct = 0.03;
    }

    // Persistent state inside closure
    let position = null; // null | 'LONG' | 'SHORT'
    let entryPrice = 0;
    let lastSLBar = -999;

    return function execute(candles, indicatorData, i, indicators) {
        const close = indicatorData.close;
        const fastEma = indicatorData.ema[fast_len];
        const slowEma = indicatorData.ema[slow_len];
        const rsi = indicatorData.rsi[rsi_len];

        if (!fastEma || !slowEma || !rsi || !fastEma[i] || !slowEma[i] || !rsi[i]) return null;

        // 1. Check Stop Loss
        if (position === 'LONG') {
            if (close[i] <= entryPrice * (1 - sl_pct)) {
                position = null;
                lastSLBar = i;
                return 'CLOSE_LONG';
            }
        } else if (position === 'SHORT') {
            if (close[i] >= entryPrice * (1 + sl_pct)) {
                position = null;
                lastSLBar = i;
                return 'CLOSE_SHORT';
            }
        }

        // 2. Check Cooldown
        if (i - lastSLBar <= cooldown) return null;

        // 3. Entry Logic
        const longCond = fastEma[i - 1] <= slowEma[i - 1] && fastEma[i] > slowEma[i] && rsi[i] > 50;
        const shortCond = fastEma[i - 1] >= slowEma[i - 1] && fastEma[i] < slowEma[i] && rsi[i] < 50;

        if (longCond) {
            position = 'LONG';
            entryPrice = close[i];
            return 'BUY';
        }

        if (shortCond) {
            position = 'SHORT';
            entryPrice = close[i];
            return 'SELL';
        }

        return null;
    };
}

module.exports = {
    id: 'dual_ema',
    name: 'Dual EMA 4H Optimized v2',
    description: 'EMA 50/200 交叉策略，配合 RSI 強弱過濾與 5% 停損機制。專為 4H BTC 設計，內建停損後冷卻期。',
    category: 'Premium',
    author: 'QuantSignal',
    pineScript,
    createStrategy,
    execute: createStrategy(), // Default export
    defaultParams: {
        fastLen: FAST_LEN,
        slowLen: SLOW_LEN,
        rsiLen: RSI_LEN,
        slPct: SL_PCT,
        cooldown: COOLDOWN_BARS
    }
};
