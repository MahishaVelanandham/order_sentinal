const crypto = require('crypto');
const storageService = require('./storage.service');
const chaosService = require('./chaos.service');
const aiService = require('./ai.service');
const { emitEvent } = require('./socket.service');
const {
  generateSyntheticCustomer,
  pickSyntheticPlan,
  generateTelecomMetadata
} = require('../utils/syntheticData');
const {
  PIPELINE_SEQUENCE,
  ORDER_STATUSES,
  ORDER_SCENARIOS,
  EVENT_TYPES
} = require('../utils/constants');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const STAGE_BASE_LATENCIES = {
  CRM: 100,
  ORDER_MANAGEMENT: 120,
  INVENTORY: 180,
  PAYMENT: 220,
  PROVISIONING: 400,
  NOTIFICATION: 90
};

class OrderSimulationEngine {
  /**
   * Generate and simulate an order
   */
  async generateAndProcessOrder(options = {}) {
    const {
      scenario = ORDER_SCENARIOS.SUCCESS,
      customCustomer,
      customPlan,
      asyncMode = false
    } = options;

    const correlationId = crypto.randomUUID();
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const customer = customCustomer || generateSyntheticCustomer();
    const plan = customPlan || pickSyntheticPlan();

    const orderData = {
      orderNumber,
      correlationId,
      customer,
      productType: plan.productType,
      plan: {
        planId: plan.planId,
        planName: plan.planName,
        speedMbps: plan.speedMbps,
        monthlyFee: plan.monthlyFee
      },
      scenario,
      currentStage: PIPELINE_SEQUENCE[0],
      overallStatus: ORDER_STATUSES.PROCESSING,
      expectedCompletionTimeMs: plan.expectedCompletionTimeMs,
      actualProcessingTimeMs: 0,
      stageTimestamps: {
        crmStartedAt: new Date()
      },
      slaBreachPredicted: false,
      slaBreachProbability: 0.05,
      failureCount: options.failureCount !== undefined ? Number(options.failureCount) : 0
    };

    const order = await storageService.createOrder(orderData);

    await storageService.createOrderEvent({
      orderId: order._id,
      orderNumber: order.orderNumber,
      correlationId: order.correlationId,
      stage: 'CRM',
      fromStage: null,
      toStage: 'CRM',
      eventType: EVENT_TYPES.STAGE_STARTED,
      httpStatusCode: 200,
      latencyMs: 0,
      metadata: { action: 'ORDER_INITIATED', customerRef: customer.customerRef }
    });

    emitEvent('order:created', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      correlationId: order.correlationId,
      stage: order.currentStage,
      status: order.overallStatus,
      scenario: order.scenario
    });

    if (asyncMode) {
      setImmediate(() => this.runPipeline(order, scenario));
      return order;
    } else {
      return await this.runPipeline(order, scenario);
    }
  }

  /**
   * Run pipeline with automatic AI Failure Detection hook
   */
  async runPipeline(order, scenario) {
    const startTime = Date.now();
    let isTerminated = false;
    let hadSlaBreach = false;
    let simulatedTotalLatency = 0;

    for (let i = 0; i < PIPELINE_SEQUENCE.length; i++) {
      if (isTerminated) break;

      const stage = PIPELINE_SEQUENCE[i];
      const nextStage = i + 1 < PIPELINE_SEQUENCE.length ? PIPELINE_SEQUENCE[i + 1] : 'COMPLETED';

      await storageService.updateOrder(order, {
        currentStage: stage,
        [`stageTimestamps.${stage.toLowerCase()}StartedAt`]: new Date()
      });

      const fault = chaosService.evaluateStageFault(stage, scenario);
      const baseLatency = STAGE_BASE_LATENCIES[stage] || 150;
      const jitter = Math.floor(Math.random() * 50);
      const stageLatency = fault.triggered && fault.delayMs ? fault.delayMs : baseLatency + jitter;
      simulatedTotalLatency += stageLatency;

      const actualSleep = fault.faultType === 'DELAY' ? Math.min(stageLatency, 500) : Math.min(stageLatency, 100);
      await sleep(actualSleep);

      const metadata = generateTelecomMetadata(stage, order.plan, order.customer);

      if (fault.triggered) {
        if (fault.faultType === 'API_ERROR_500' || fault.faultType === 'API_ERROR_504') {
          await storageService.createOrderEvent({
            orderId: order._id,
            orderNumber: order.orderNumber,
            correlationId: order.correlationId,
            stage,
            fromStage: stage,
            toStage: stage,
            eventType: EVENT_TYPES.STAGE_FAILED,
            httpStatusCode: fault.httpStatusCode,
            latencyMs: stageLatency,
            metadata: { ...metadata, errorCategory: 'API_RESPONSE_ERROR' },
            errorMessage: fault.errorMessage
          });

          await storageService.updateOrder(order, {
            overallStatus: ORDER_STATUSES.FAILED,
            failureCount: (order.failureCount || 0) + 1,
            failureDetails: {
              stage,
              httpStatusCode: fault.httpStatusCode,
              errorMessage: fault.errorMessage,
              failureType: 'API_RESPONSE_ERROR'
            },
            actualProcessingTimeMs: Date.now() - startTime
          });

          emitEvent('order:failed', {
            orderNumber: order.orderNumber,
            correlationId: order.correlationId,
            stage,
            status: ORDER_STATUSES.FAILED,
            error: fault.errorMessage,
            statusCode: fault.httpStatusCode
          });

          isTerminated = true;
          break;
        } else if (fault.faultType === 'REJECTION') {
          await storageService.createOrderEvent({
            orderId: order._id,
            orderNumber: order.orderNumber,
            correlationId: order.correlationId,
            stage,
            fromStage: stage,
            toStage: stage,
            eventType: EVENT_TYPES.STAGE_REJECTED,
            httpStatusCode: fault.httpStatusCode,
            latencyMs: stageLatency,
            metadata: { ...metadata, rejectionCategory: 'BUSINESS_VALIDATION' },
            errorMessage: fault.errorMessage
          });

          await storageService.updateOrder(order, {
            overallStatus: ORDER_STATUSES.REJECTED,
            failureDetails: {
              stage,
              httpStatusCode: fault.httpStatusCode,
              errorMessage: fault.errorMessage,
              failureType: 'ORDER_REJECTION'
            },
            actualProcessingTimeMs: Date.now() - startTime
          });

          emitEvent('order:rejected', {
            orderNumber: order.orderNumber,
            correlationId: order.correlationId,
            stage,
            status: ORDER_STATUSES.REJECTED,
            reason: fault.errorMessage
          });

          isTerminated = true;
          break;
        } else if (fault.faultType === 'STUCK') {
          await storageService.createOrderEvent({
            orderId: order._id,
            orderNumber: order.orderNumber,
            correlationId: order.correlationId,
            stage,
            fromStage: stage,
            toStage: nextStage,
            eventType: EVENT_TYPES.STAGE_STUCK,
            httpStatusCode: fault.httpStatusCode,
            latencyMs: stageLatency,
            metadata: { ...metadata, lockStatus: 'THREAD_DEADLOCK_SIMULATED' },
            errorMessage: fault.errorMessage
          });

          await storageService.updateOrder(order, {
            overallStatus: ORDER_STATUSES.STUCK,
            failureDetails: {
              stage,
              httpStatusCode: fault.httpStatusCode,
              errorMessage: fault.errorMessage,
              failureType: 'STUCK_PIPELINE'
            },
            actualProcessingTimeMs: Date.now() - startTime
          });

          emitEvent('order:stuck', {
            orderNumber: order.orderNumber,
            correlationId: order.correlationId,
            stage,
            status: ORDER_STATUSES.STUCK,
            error: fault.errorMessage
          });

          isTerminated = true;
          break;
        } else if (fault.faultType === 'DELAY') {
          hadSlaBreach = true;
          await storageService.createOrderEvent({
            orderId: order._id,
            orderNumber: order.orderNumber,
            correlationId: order.correlationId,
            stage,
            fromStage: stage,
            toStage: nextStage,
            eventType: EVENT_TYPES.STAGE_DELAYED,
            httpStatusCode: 200,
            latencyMs: stageLatency,
            metadata: { ...metadata, delayAnomaly: true },
            errorMessage: fault.errorMessage
          });

          await storageService.updateOrder(order, {
            overallStatus: ORDER_STATUSES.DELAYED,
            slaBreachPredicted: true,
            slaBreachProbability: 0.92
          });

          emitEvent('order:delayed', {
            orderNumber: order.orderNumber,
            correlationId: order.correlationId,
            stage,
            status: ORDER_STATUSES.DELAYED,
            latencyMs: stageLatency
          });
        }
      }

      if (!isTerminated) {
        await storageService.createOrderEvent({
          orderId: order._id,
          orderNumber: order.orderNumber,
          correlationId: order.correlationId,
          stage,
          fromStage: stage,
          toStage: nextStage,
          eventType: EVENT_TYPES.STAGE_COMPLETED,
          httpStatusCode: 200,
          latencyMs: stageLatency,
          metadata
        });

        await storageService.updateOrder(order, {
          [`stageTimestamps.${stage.toLowerCase()}CompletedAt`]: new Date(),
          currentStage: nextStage
        });

        emitEvent('order:progressed', {
          orderNumber: order.orderNumber,
          correlationId: order.correlationId,
          stage,
          nextStage,
          latencyMs: stageLatency
        });
      }
    }

    if (!isTerminated) {
      const totalElapsed = hadSlaBreach ? Math.max(simulatedTotalLatency, 4500) : simulatedTotalLatency;
      const finalStatus = hadSlaBreach ? ORDER_STATUSES.DELAYED : ORDER_STATUSES.COMPLETED;

      await storageService.updateOrder(order, {
        currentStage: 'COMPLETED',
        overallStatus: finalStatus,
        actualProcessingTimeMs: totalElapsed
      });

      emitEvent('order:completed', {
        orderNumber: order.orderNumber,
        correlationId: order.correlationId,
        status: finalStatus,
        totalDurationMs: totalElapsed
      });
    }

    // -------------------------------------------------------------
    // Automatic AI Failure Detection Trigger
    // -------------------------------------------------------------
    if (order.overallStatus !== ORDER_STATUSES.COMPLETED || hadSlaBreach) {
      try {
        const events = await storageService.findEventsByOrder(order);
        const detectionPayload = {
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

        const detectionResult = await aiService.detectFailure(detectionPayload);

        if (detectionResult && detectionResult.isFailure) {
          const incidentId = `INC-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
          await storageService.createIncident({
            incidentId,
            orderId: order._id,
            orderNumber: order.orderNumber,
            correlationId: order.correlationId,
            failureCategory: detectionResult.failureCategory,
            failureReason: detectionResult.failureReason,
            affectedService: detectionResult.affectedService,
            severity: detectionResult.severity,
            supportingEvidence: detectionResult.supportingEvidence,
            detectionTimestamp: new Date(detectionResult.detectionTimestamp)
          });
        }
      } catch (detErr) {
        console.warn('[Detection Hook Warning] Failed to run automated detection:', detErr.message);
      }
    }

    return order;
  }
}

module.exports = new OrderSimulationEngine();
