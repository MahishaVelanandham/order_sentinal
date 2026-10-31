require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const { initSocket } = require('./services/socket.service');

// Import Route Handlers
const healthRoutes = require('./routes/health.routes');
const orderRoutes = require('./routes/order.routes');
const chaosRoutes = require('./routes/chaos.routes');
const incidentRoutes = require('./routes/incident.routes');
const remediationRoutes = require('./routes/remediation.routes');
const twinRoutes = require('./routes/twin.routes');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/orderflow_sentinel';

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});
initSocket(io);

// Core Middleware
app.use(cors({
  origin: CLIENT_ORIGIN,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// API Route Registration
app.use('/api/health', healthRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/chaos', chaosRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/remediation', remediationRoutes);
app.use('/api/twin', twinRoutes);

// Root route welcome
app.get('/', (req, res) => {
  res.json({
    project: 'OrderFlow Sentinel Backend',
    status: 'ONLINE',
    documentation: '/docs',
    healthCheck: '/api/health'
  });
});

// Central Error Handling Middleware
app.use(errorHandler);

// Database Connection & Server Startup
mongoose.connect(MONGO_URI)
  .then((conn) => {
    console.log(`[MongoDB] Connected successfully to database: '${conn.connection.name}' (${conn.connection.host}:${conn.connection.port})`);
    console.log(`[MongoDB] Storage Mode: PERSISTENT_MONGODB (Collections: orders, orderevents, incidentlogs, healingactions, digitaltwinscenarios)`);
  })
  .catch((err) => {
    console.warn(`[MongoDB Warning] Could not connect to MongoDB.`);
    console.warn(`[MongoDB Warning] Storage Mode: IN-MEMORY FALLBACK ACTIVE (WARNING: Records will NOT survive backend restarts).`);
  });

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🛡️  OrderFlow Sentinel Backend Running`);
  console.log(`🚀 Server listening on: http://localhost:${PORT}`);
  console.log(`🩺 Health check URL:   http://localhost:${PORT}/api/health`);
  console.log(`📡 WebSocket ready for client: ${CLIENT_ORIGIN}`);
  console.log(`====================================================`);
});
