const axios = require('axios');

const AI_BASE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';

const aiClient = axios.create({
  baseURL: AI_BASE_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Service to communicate with Python AI Microservice (FastAPI)
 */
class AIService {
  /**
   * Check Python AI microservice health
   */
  static async checkHealth() {
    try {
      const response = await aiClient.get('/health');
      return {
        isAvailable: true,
        data: response.data
      };
    } catch (error) {
      return {
        isAvailable: false,
        error: error.message
      };
    }
  }

  /**
   * Call Python Failure Detection Engine
   */
  static async detectFailure(payload) {
    try {
      const response = await aiClient.post('/detect/failure', payload);
      return response.data;
    } catch (error) {
      console.warn('[AIService] Python detection service unreachable, using local fallback:', error.message);
      const isErr = payload.overallStatus === 'FAILED' || payload.overallStatus === 'REJECTED' || payload.overallStatus === 'DELAYED' || payload.overallStatus === 'STUCK';
      return {
        orderNumber: payload.orderNumber,
        correlationId: payload.correlationId,
        isFailure: isErr,
        failureCategory: payload.overallStatus === 'FAILED' ? 'API_RESPONSE_ERROR' : payload.overallStatus === 'REJECTED' ? 'ORDER_REJECTION' : payload.overallStatus === 'DELAYED' || payload.overallStatus === 'STUCK' ? 'ORDER_DELAY' : 'NONE',
        failureReason: isErr ? `Detected failure state: ${payload.overallStatus}` : 'Healthy',
        affectedService: payload.currentStage,
        severity: isErr ? 'HIGH' : 'NONE',
        detectionTimestamp: new Date().toISOString(),
        supportingEvidence: { fallback: true, error: error.message }
      };
    }
  }

  /**
   * Call Python Root Cause Analysis (RCA) Engine
   */
  static async analyzeRCA(payload) {
    try {
      const response = await aiClient.post('/rca/analyze', payload);
      return response.data;
    } catch (error) {
      console.warn('[AIService] Python RCA service unreachable, using fallback heuristics:', error.message);
      return {
        orderNumber: payload.orderNumber,
        correlationId: payload.correlationId,
        failedStage: payload.currentStage,
        failureSummary: `Failure in ${payload.currentStage}`,
        rootCauseExplanation: 'Root cause uncertain - manual investigation required.',
        possibleReasons: ['Python AI service was unreachable during evaluation'],
        previousStages: [],
        affectedDownstreamServices: [],
        recommendedAction: 'Inspect telemetry manually or retry when AI engine is online.',
        riskTier: 'HIGH',
        confidenceScore: 0.3,
        analysisTimestamp: new Date().toISOString(),
        supportingEvidence: { fallback: true, error: error.message }
      };
    }
  }

  /**
   * Predict Digital Twin What-If Failure & Prevention Scenarios for an Order
   */
  static async predictDigitalTwinOrder(payload) {
    try {
      const response = await aiClient.post('/twin/predict-order', payload);
      return response.data;
    } catch (error) {
      console.error('[AIService] Failed to run digital twin order prediction:', error.message);
      throw error;
    }
  }

  /**
   * Legacy Cluster Simulation
   */
  static async simulateDigitalTwin(scenarioParams) {
    try {
      const response = await aiClient.post('/simulate/twin', scenarioParams);
      return response.data;
    } catch (error) {
      console.error('[AIService] Failed to run digital twin cluster simulation:', error.message);
      throw error;
    }
  }

  static async requestRCA(telemetry) {
    try {
      const response = await aiClient.post('/predict/rca', telemetry);
      return response.data;
    } catch (error) {
      return {
        rootCause: 'UNREACHABLE_AI_FALLBACK_ANALYSIS',
        confidenceScore: 0.5,
        riskTier: 'MEDIUM',
        recommendedAction: 'EXPONENTIAL_RETRY'
      };
    }
  }

  static async predictSLABreach(orderMetrics) {
    try {
      const response = await aiClient.post('/predict/sla-breach', orderMetrics);
      return response.data;
    } catch (error) {
      return {
        breachProbability: 0.0,
        riskLevel: 'UNKNOWN'
      };
    }
  }
}

module.exports = AIService;
