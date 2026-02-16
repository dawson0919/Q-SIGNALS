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

// WebSocket for live price streaming and online status
const wss = new WebSocketServer({ server, path: '/ws/prices' });
const onlineUsers = new Map(); // Store userId -> socket

wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const userId = url.searchParams.get('userId');

    if (userId && userId !== 'null' && userId !== 'undefined') {
        onlineUsers.set(userId, ws);
        console.log(`[WS] User ${userId} is online. Total: ${onlineUsers.size}`);
    } else {
        console.log('[WS] Anonymous client connected');
    }

    // Send current prices immediately
    const prices = getCurrentPrices();
    if (Object.keys(prices).length > 0) {
        ws.send(JSON.stringify({ type: 'prices', data: prices }));
    }

    ws.on('close', () => {
        if (userId) {
            onlineUsers.delete(userId);
            console.log(`[WS] User ${userId} went offline. Total: ${onlineUsers.size}`);
        } else {
            console.log('[WS] Anonymous client disconnected');
        }
    });
});

// Broadcast price updates to all connected clients
function broadcastPrices(data) {
    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(JSON.stringify({ type: 'prices', data }));
        }
    });
}

// Global accessor for routes to check online status
global.getOnlineUsers = () => Array.from(onlineUsers.keys());
global.broadcastPrices = broadcastPrices;

// Start server
async function start() {
    try {
        console.log('🚀 Starting QuantSignal Server...');

        // 1. Initialize Supabase
        const supabase = initSupabase();
        console.log('✅ Supabase connected');

        // 5. Start HTTP server
        server.listen(PORT, () => {
            console.log(`\n🟢 QuantSignal running at http://localhost:${PORT}`);
            console.log(`   WebSocket: ws://localhost:${PORT}/ws/prices`);
            console.log(`   Admin: http://localhost:${PORT}/admin.html`);

            // Trigger backfill in background after server is listening
            startBackgroundTasks();
        });

    } catch (err) {
        console.error('❌ Startup error:', err);
        process.exit(1);
    }
}

async function startBackgroundTasks() {
    try {
        // 2. Backfill historical data (now in background)
        console.log('📊 Starting background historical data backfill...');
        await backfillAllSymbols();
        console.log('✅ Background historical data backfill complete');

        // 3. Start real-time price monitor
        startPriceMonitor();
        console.log('✅ Real-time price monitor started');

        // 4. Start scheduled sync (every 4 hours)
        startScheduledSync();
        console.log('✅ Scheduled sync started (every 4h)');
    } catch (err) {
        console.error('❌ Background task error:', err);
    }
}

start();

// Force restart to clear backtest cache and ensure consistency

// Force restart 4: CoinGecko Fallback for XAU (90d limit)
