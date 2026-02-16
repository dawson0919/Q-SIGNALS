// QuantSignal Server - Quantitative Trading Strategy Platform
require('dotenv').config(); // Load .env BEFORE any other modules
const express = require('express');
const cors = require('cors');
const path = require('path');
const { WebSocketServer } = require('ws');
const http = require('http');

const { initSupabase } = require('./src/data/database');
const { backfillAllSymbols, startScheduledSync } = require('./src/data/backfill');
const { startPriceMonitor, getCurrentPrices } = require('./src/data/priceMonitor');
const apiRoutes = require('./src/api/routes');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api', apiRoutes);

// WebSocket for live price streaming
const wss = new WebSocketServer({ server, path: '/ws/prices' });

wss.on('connection', (ws) => {
    console.log('[WS] Client connected');
    // Send current prices immediately
    const prices = getCurrentPrices();
    if (Object.keys(prices).length > 0) {
        ws.send(JSON.stringify({ type: 'prices', data: prices }));
    }
    ws.on('close', () => console.log('[WS] Client disconnected'));
});

// Broadcast price updates to all connected clients
function broadcastPrices(data) {
    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(JSON.stringify({ type: 'prices', data }));
        }
    });
}

// Export for priceMonitor to use
global.broadcastPrices = broadcastPrices;

// Start server
async function start() {
    try {
        console.log('🚀 Starting QuantSignal Server...');

        // 1. Initialize Supabase
        const supabase = initSupabase();
        console.log('✅ Supabase connected');

        // 2. Backfill historical data
        console.log('📊 Starting historical data backfill...');
        await backfillAllSymbols();
        console.log('✅ Historical data backfill complete');

        // 3. Start real-time price monitor
        startPriceMonitor();
        console.log('✅ Real-time price monitor started');

        // 4. Start scheduled sync (every 4 hours)
        startScheduledSync();
        console.log('✅ Scheduled sync started (every 4h)');

        // 5. Start HTTP server
        server.listen(PORT, () => {
            console.log(`\n🟢 QuantSignal running at http://localhost:${PORT}`);
            console.log(`   WebSocket: ws://localhost:${PORT}/ws/prices`);
            console.log(`   Admin: http://localhost:${PORT}/admin.html`);
        });
    } catch (err) {
        console.error('❌ Startup error:', err);
        process.exit(1);
    }
}

start();

// Force restart to clear backtest cache and ensure consistency

// Force restart 3: Revert XAU to Binance (Final)
