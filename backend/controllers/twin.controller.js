const crypto = require('crypto');
const storageService = require('../services/storage.service');
const aiService = require('../services/ai.service');
const { emitEvent } = require('../services/socket.service');

/**
 * Predict potential SLA breaches & simulate What-If scenarios for an order
 * POST /api/twin/predict/:orderId
 * IMPORTANT: Strictly decoupled from actual execution (does not modify real order state).
 */
const predictOrderDigitalTwin = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const order = await storageService.findOrderByIdentifier(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found with identifier: '${orderId}'`
      });
    }

    const events = await storageService.findEventsByOrder(order);

    // Extract recent telemetry
    const lastEvent = events[events.length - 1];
    const currentApiLatency = lastEvent ? lastEvent.latencyMs : 250.0;
    const currentQueueDelay = req.body.queueDelayMs !== undefined ? Number(req.body.queueDelayMs) : 120.0;
    const serviceHealthScore = req.body.serviceHealthScore !== undefined ? Number(req.body.serviceHealthScore) : 0.88;
    const serviceFailureRate = req.body.serviceFailureRate !== undefined ? Number(req.body.serviceFailureRate) : 0.04;

    const twinPayload = {
      orderNumber: order.orderNumber,
      correlationId: order.correlationId,
      currentStage: order.currentStage === 'COMPLETED' ? 'PROVISIONING' : order.currentStage,
      elapsedTimeMs: order.actualProcessingTimeMs || 450.0,
      expectedSlaMs: order.expectedCompletionTimeMs || 2500.0,
      currentApiLatencyMs: currentApiLatency,
      queueDelayMs: currentQueueDelay,
      retryCount: order.failureCount || 0,
      serviceHealthScore,
      serviceFailureRate,
      previousStages: events.map((e) => ({
        stage: e.stage,
        status: e.eventType === 'STAGE_COMPLETED' ? 'SUCCESS' : e.eventType,
        httpStatusCode: e.httpStatusCode,
        latencyMs: e.latencyMs
      }))
    };

    // Run What-If simulation in Python FastAPI engine
    const predictionResult = await aiService.predictDigitalTwinOrder(twinPayload);

    // Save prediction history to MongoDB (without changing real order)
    const predictionId = `PRED-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const savedRecord = await storageService.createTwinPrediction({
      predictionId,
      orderNumber: order.orderNumber,
      correlationId: order.correlationId,
      currentStage: predictionResult.currentStage,
      elapsedTimeMs: predictionResult.elapsedTimeMs,
      expectedSlaMs: predictionResult.expectedSlaMs,
      baselineBreachRisk: predictionResult.baselineBreachRisk,
      mlModelBreachProbability: predictionResult.mlModelBreachProbability,
      modelAccuracy: predictionResult.modelAccuracy,
      isServiceAnomalous: predictionResult.isServiceAnomalous,
      safestScenario: predictionResult.safestScenario,
      scenarioComparisons: predictionResult.scenarioComparisons,
      prescriptiveRecommendation: predictionResult.prescriptiveRecommendation,
      analysisTimestamp: new Date(predictionResult.analysisTimestamp)
    });

    emitEvent('twin:predicted', {
      orderNumber: order.orderNumber,
      predictionId,
      safestScenario: predictionResult.safestScenario
    });

    res.status(200).json({
      success: true,
      message: 'Predictive Digital Twin What-If simulation completed successfully.',
      data: savedRecord
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve Digital Twin prediction history
 * GET /api/twin/history
 */
const getTwinHistory = async (req, res, next) => {
  try {
    const { orderNumber, limit = 50, skip = 0 } = req.query;
    const filter = {};
    if (orderNumber) filter.orderNumber = orderNumber;

    const { data: records, total } = await storageService.findTwinPredictions(filter, {
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10)
    });

    res.status(200).json({
      success: true,
      pagination: {
        total,
        limit: parseInt(limit, 10),
        skip: parseInt(skip, 10),
        returned: records.length
      },
      data: records
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cluster-level stress simulation (Monte Carlo)
 * POST /api/twin/simulate
 */
const runSimulation = async (req, res, next) => {
  try {
    const { orderArrivalMultiplier = 1.3, injectedStageDelayMs = { stage: 'PROVISIONING', addedDelay: 1000 } } = req.body;
    const simulationResult = await aiService.simulateDigitalTwin({
      orderArrivalMultiplier,
      injectedStageDelayMs
    });

    res.status(200).json({
      success: true,
      data: simulationResult
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  predictOrderDigitalTwin,
  getTwinHistory,
  runSimulation
};
