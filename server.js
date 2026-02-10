const express = require('express');
const { ExpressPeerServer } = require('peer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 9000;

app.use(cors());
app.use(express.json());

// ==================== MATCHMAKING QUEUE ====================
// Simple queue-based matchmaking - no more timing issues!

const queue = [];  // Array of { oderId, odername, timestamp }
const matches = new Map();  // oderId -> partnerId

// Join the matchmaking queue
app.post('/queue/join', (req, res) => {
    const { oderId, odername } = req.body;
    if (!oderId) {
        return res.status(400).json({ error: 'oderId required' });
    }

    // Check if user already has a match (reconnect scenario)
    const existingMatch = matches.get(oderId);
    if (existingMatch) {
        console.log(`[QUEUE] ${odername} already matched with ${existingMatch.odername}, returning existing match`);
        return res.json({
            matched: true,
            partnerId: existingMatch.oderId,
            partnerName: existingMatch.odername
        });
    }

    // Remove if already in queue (rejoin scenario)
    const existingIndex = queue.findIndex(p => p.oderId === oderId);
    if (existingIndex !== -1) {
        queue.splice(existingIndex, 1);
    }

    // Check if someone is waiting in the queue
    if (queue.length > 0) {
        const partner = queue.shift();

        // Create bidirectional match with timestamp
        const matchTime = Date.now();
        matches.set(oderId, { oderId: partner.oderId, odername: partner.odername, timestamp: matchTime });
        matches.set(partner.oderId, { oderId: oderId, odername: odername, timestamp: matchTime });

        console.log(`[MATCH] ${odername} <-> ${partner.odername}`);

        return res.json({
            matched: true,
            partnerId: partner.oderId,
            partnerName: partner.odername
        });
    }

    // No one waiting - add to queue
    queue.push({ oderId, odername: odername || 'Anonymous', timestamp: Date.now() });
    console.log(`[QUEUE] ${odername || oderId} joined, queue size: ${queue.length}`);

    res.json({ matched: false, position: queue.length });
});

// Poll for match (for users waiting in queue)
app.get('/queue/match/:oderId', (req, res) => {
    const { oderId } = req.params;
    const partner = matches.get(oderId);

    if (partner) {
        // Don't delete yet - let the client confirm connection
        return res.json({
            matched: true,
            partnerId: partner.oderId,
            partnerName: partner.odername
        });
    }

    // Check if still in queue
    const inQueue = queue.some(p => p.oderId === oderId);
    res.json({ matched: false, inQueue });
});

// Confirm match was successful (cleanup)
app.post('/queue/confirm', (req, res) => {
    const { oderId } = req.body;
    matches.delete(oderId);
    res.json({ success: true });
});

// Leave queue (user cancelled or disconnected)
app.post('/queue/leave', (req, res) => {
    const { oderId } = req.body;

    // Remove from queue
    const index = queue.findIndex(p => p.oderId === oderId);
    if (index !== -1) {
        console.log(`[QUEUE] ${queue[index].odername} left, queue size: ${queue.length - 1}`);
        queue.splice(index, 1);
    }

    // Remove any pending match
    matches.delete(oderId);

    res.json({ success: true });
});

// Health check / stats
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        queueSize: queue.length,
        pendingMatches: matches.size
    });
});

// Debug endpoint - see queue state
app.get('/debug/queue', (req, res) => {
    res.json({
        queue: queue.map(p => ({ name: p.odername, waiting: Date.now() - p.timestamp })),
        matches: Array.from(matches.entries())
    });
});

// ==================== PEER SERVER ====================

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Matchmaking: POST /queue/join, GET /queue/match/:id`);
    console.log(`PeerJS: /peerjs`);
});

const peerServer = ExpressPeerServer(server, {
    path: '/peerjs',
    allow_discovery: true,
    expire_timeout: 5000,
    alive_timeout: 60000,
    key: 'spotiroulette'
});

app.use('/', peerServer);

peerServer.on('connection', (client) => {
    console.log(`[PEER] Connected: ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
    console.log(`[PEER] Disconnected: ${client.getId()}`);

    // Only clean up queue, NOT matches
    // Matches should persist so users can reconnect (especially on mobile)
    const index = queue.findIndex(p => p.oderId === client.getId());
    if (index !== -1) {
        console.log(`[QUEUE] Removing disconnected: ${queue[index].odername}`);
        queue.splice(index, 1);
    }
    // Don't delete matches here - let cleanup interval handle stale ones
});

// ==================== CLEANUP ====================

// Remove stale queue and match entries every 30 seconds
setInterval(() => {
    const now = Date.now();
    const queueTimeout = 120000; // 2 minutes for queue
    const matchTimeout = 300000; // 5 minutes for matches
    let removedQueue = 0;
    let removedMatches = 0;

    // Clean stale queue entries
    for (let i = queue.length - 1; i >= 0; i--) {
        if (now - queue[i].timestamp > queueTimeout) {
            console.log(`[CLEANUP] Removing stale queue: ${queue[i].odername}`);
            queue.splice(i, 1);
            removedQueue++;
        }
    }

    // Clean stale match entries
    for (const [oderId, match] of matches.entries()) {
        if (match.timestamp && now - match.timestamp > matchTimeout) {
            console.log(`[CLEANUP] Removing stale match: ${oderId}`);
            matches.delete(oderId);
            removedMatches++;
        }
    }

    if (removedQueue > 0 || removedMatches > 0) {
        console.log(`[CLEANUP] Removed ${removedQueue} queue, ${removedMatches} matches`);
    }
}, 30000);
