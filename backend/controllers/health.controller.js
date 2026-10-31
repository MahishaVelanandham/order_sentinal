const mongoose = require('mongoose');
const AIService = require('../services/ai.service');

/**
 * Health check controller reporting backend, database, and AI engine status
 */
const getHealthStatus = async (req, res, next) => {
  try {
    const dbState = mongoose.connection.readyState;
    const dbStatusMap = {
      0: 'DISCONNECTED',
      1: 'CONNECTED',
      2: 'CONNECTING',
      3: 'DISCONNECTING'
    };

    const aiHealth = await AIService.checkHealth();
    const isMongoConnected = dbState === 1;
    const storageMode = isMongoConnected ? 'PERSISTENT_MONGODB' : 'IN_MEMORY_FALLBACK';
    const storageWarning = isMongoConnected
      ? null
      : 'IN-MEMORY FALLBACK ACTIVE: Records will NOT survive backend restarts. Local MongoDB Community Server is required for persistence.';

    const healthReport = {
      status: 'UP',
      service: 'OrderFlow Sentinel Backend',
      version: '1.0.0',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      storageMode,
      dependencies: {
        database: {
          name: 'MongoDB',
          status: dbStatusMap[dbState] || 'UNKNOWN',
          isReady: isMongoConnected,
          mode: storageMode,
          databaseName: isMongoConnected ? mongoose.connection.name : null,
          ...(storageWarning && { warning: storageWarning })
        },
        aiEngine: {
          name: 'Python FastAPI Microservice',
          status: aiHealth.isAvailable ? 'CONNECTED' : 'DISCONNECTED',
          details: aiHealth.data || { error: aiHealth.error }
        }
      }
    };

    res.status(200).json(healthReport);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHealthStatus
};
