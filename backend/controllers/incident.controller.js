const crypto = require('crypto');
const storageService = require('../services/storage.service');
const aiService = require('../services/ai.service');
const { emitEvent } = require('../services/socket.service');

/**
 * Trigger failure detection on a specific order
 * POST /api/incidents/detect/:id
 */
const detectOrderFailure = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await storageService.findOrderByIdentifier(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found with identifier: '${id}'`
      });
    }

    const events = await storageService.findEventsByOrder(order);

    const payload = {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      correlationId: order.correlationId,
      currentStage: order.currentStage,
      overallStatus: order.overallStatus,
      expectedCompletionTimeMs: order.expectedCompletionTimeMs,
      actualProcessingTimeMs: order.actualProcessingTimeMs,
      timeline: events.map((ev) => ({
        stage: ev.stage,
        eventType: ev.eventType,
        httpStatusCode: ev.httpStatusCode,
        latencyMs: ev.latencyMs,
        errorMessage: ev.errorMessage,
        metadata: ev.metadata,
        timestamp: ev.timestamp ? new Date(ev.timestamp).toISOString() : null
      }))
    };

    const detectionResult = await aiService.detectFailure(payload);

    let persistedIncident = null;

    if (detectionResult && detectionResult.isFailure) {
      const incidentId = `INC-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

      persistedIncident = await storageService.createIncident({
        incidentId,
        orderId: order._id,
        orderNumber: order.orderNumber,
        correlationId: order.correlationId,
        failureCategory: detectionResult.failureCategory,
        failureReason: detectionResult.failureReason,
        affectedService: detectionResult.affectedService,
        failedStage: detectionResult.affectedService,
        severity: detectionResult.severity,
        httpStatusCode: detectionResult.supportingEvidence?.httpStatusCode || (detectionResult.failureCategory === 'ORDER_REJECTION' ? 422 : (detectionResult.failureCategory === 'ORDER_DELAY' ? 200 : 504)),
        resolutionStatus: 'PENDING',
        rootCause: detectionResult.failureReason,
        supportingEvidence: detectionResult.supportingEvidence,
        detectionTimestamp: new Date(detectionResult.detectionTimestamp)
      });

      emitEvent('incident:detected', persistedIncident);
    }

    res.status(200).json({
      success: true,
      incidentDetected: detectionResult ? Boolean(detectionResult.isFailure) : false,
      incident: persistedIncident || detectionResult,
      data: {
        detection: detectionResult,
        incidentRecord: persistedIncident
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Run Root Cause Analysis (RCA) on an order
 * POST /api/incidents/rca/:id
 */
const runOrderRCA = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await storageService.findOrderByIdentifier(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found with identifier: '${id}'`
      });
    }

    const events = await storageService.findEventsByOrder(order);

    // Call Python RCA Engine
    const rcaPayload = {
      orderNumber: order.orderNumber,
      correlationId: order.correlationId,
      currentStage: order.currentStage,
      overallStatus: order.overallStatus,
      expectedCompletionTimeMs: order.expectedCompletionTimeMs,
      actualProcessingTimeMs: order.actualProcessingTimeMs,
      timeline: events.map((ev) => ({
        stage: ev.stage,
        eventType: ev.eventType,
        httpStatusCode: ev.httpStatusCode,
        latencyMs: ev.latencyMs,
        errorMessage: ev.errorMessage,
        metadata: ev.metadata,
        timestamp: ev.timestamp ? new Date(ev.timestamp).toISOString() : null
      }))
    };

    const rcaResult = await aiService.analyzeRCA(rcaPayload);

    // Find existing incident or create one to store RCA results
    let incident = await storageService.findIncidentByIdentifier(order.orderNumber);

    if (!incident) {
      const incidentId = `INC-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      incident = await storageService.createIncident({
        incidentId,
        orderId: order._id,
        orderNumber: order.orderNumber,
        correlationId: order.correlationId,
        failureCategory: rcaResult.riskTier === 'LOW' && rcaResult.failedStage !== 'NONE' ? 'API_RESPONSE_ERROR' : 'ORDER_DELAY',
        failureReason: rcaResult.failureSummary,
        affectedService: rcaResult.failedStage,
        severity: rcaResult.riskTier === 'HIGH' ? 'CRITICAL' : 'HIGH',
        rcaDetails: rcaResult,
        supportingEvidence: rcaResult.supportingEvidence,
        detectionTimestamp: new Date()
      });
    } else {
      incident = await storageService.updateIncident(incident, {
        rcaDetails: rcaResult
      });
    }

    emitEvent('rca:completed', {
      orderNumber: order.orderNumber,
      incidentId: incident.incidentId,
      rca: rcaResult
    });

    res.status(200).json({
      success: true,
      rca: rcaResult,
      data: {
        orderNumber: order.orderNumber,
        correlationId: order.correlationId,
        incidentId: incident.incidentId,
        rca: rcaResult
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Root Cause Analysis results for an order or incident
 * GET /api/incidents/rca/:id
 */
const getOrderRCA = async (req, res, next) => {
  try {
    const { id } = req.params;
    let incident = await storageService.findIncidentByIdentifier(id);

    if (!incident || !incident.rcaDetails) {
      // If not yet analyzed, trigger on-demand analysis
      return runOrderRCA(req, res, next);
    }

    res.status(200).json({
      success: true,
      rca: incident.rcaDetails,
      data: {
        incidentId: incident.incidentId,
        orderNumber: incident.orderNumber,
        correlationId: incident.correlationId,
        rca: incident.rcaDetails
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all detected incidents with filtering
 * GET /api/incidents
 */
const getIncidents = async (req, res, next) => {
  try {
    const {
      category,
      severity,
      status,
      orderNumber,
      limit = 50,
      skip = 0
    } = req.query;

    const filter = {};
    if (category) filter.failureCategory = category.toUpperCase();
    if (severity) filter.severity = severity.toUpperCase();
    if (status) filter.resolutionStatus = status.toUpperCase();
    if (orderNumber) filter.orderNumber = orderNumber;

    const { data: incidents, total } = await storageService.findIncidents(filter, {
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10)
    });

    res.status(200).json({
      success: true,
      pagination: {
        total,
        limit: parseInt(limit, 10),
        skip: parseInt(skip, 10),
        returned: incidents.length
      },
      data: incidents
    });
  } catch (error) {
    next(error);
  }
};

const getHealingActions = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      count: 0,
      data: []
    });
  } catch (error) {
    next(error);
  }
};

const resolveManualIncident = async (req, res, next) => {
  try {
    const { id } = req.params;
    const incident = await storageService.findIncidentByIdentifier(id);
    if (!incident) {
      return res.status(404).json({ success: false, message: 'Incident not found' });
    }
    await storageService.updateIncident(incident, { resolutionStatus: 'AUTO_RESOLVED' });
    res.status(200).json({
      success: true,
      message: `Incident ${id} marked resolved.`,
      data: incident
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  detectOrderFailure,
  runOrderRCA,
  getOrderRCA,
  getIncidents,
  getHealingActions,
  resolveManualIncident
};
