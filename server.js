const { PeerServer } = require('peer');

const PORT = process.env.PORT || 9000;

const peerServer = PeerServer({
  port: PORT,
  path: '/peerjs',
  allow_discovery: true,
  // Increase limits for more concurrent users
  expire_timeout: 5000,
  alive_timeout: 60000,
  key: 'spotiroulette',
  // Enable CORS for your domain
  corsOptions: {
    origin: '*' // In production, restrict to your domain
  }
});

peerServer.on('connection', (client) => {
  console.log(`Client connected: ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
  console.log(`Client disconnected: ${client.getId()}`);
});

console.log(`PeerJS signaling server running on port ${PORT}`);
console.log(`Endpoint: http://localhost:${PORT}/peerjs`);
