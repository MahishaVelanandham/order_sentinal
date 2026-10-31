const crypto = require('crypto');
const storageService = require('./storage.service');
const { emitEvent } = require('./socket.service');
const { generateTelecomMetadata } = require('../utils/syntheticData');
const { PIPELINE_SEQUENCE, ORDER_STATUSES, EVENT_TYPES } = require('../utils/constants');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_RETRY_LIMIT = 3;

class RemediationService {
  /**
   * Determine the safest recommended resolution based on failure telemetry
   */
  recommendResolution(order, failureData = {}) {
    const stage = failureData.stage || order.currentStage || 'PAYMENT';
    const httpCode = failureData.httpStatusCode || order.failureDetails?.httpStatusCode || 500;
    const failureType = failureData.failureType || order.failureDetails?.failureType || 'API_RESPONSE_ERROR';
    const errMessage = (failureData.errorMessage || order.failureDetails?.errorMessage || '').toLowerCase();
    const currentRetries = (order.failureCount || 1);

    // Idempotency Key ensures duplicate requests are safely de-duplicated
    const idempotencyKey = `IDEM-${order.orderNumber}-${stage}-ATTEMPT-${currentRetries}`;
    const actionId = `ACT-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    // 1. Check Max Retry Limit to prevent infinite retry loops
    if (currentRetries > MAX_RETRY_LIMIT) {
      return {
        actionId,
        idempotencyKey,
        orderNumber: order.orderNumber,
        correlationId: order.correlationId,
        stage,
        actionType: 'ESCALATE_HUMAN_OPERATOR',
        recommendedAction: 'ESCALATE_TO_OPERATOR',
        riskTier: 'HIGH_RISK',
        requiresHumanApproval: true,
        autoHealEligible: false,
        decisionReason: `Max retry limit (${MAX_RETRY_LIMIT}) exceeded. Circuit breaker tripped to prevent infinite retry loops.`,
        parameters: {
          attemptNumber: currentRetries,
          maxRetries: MAX_RETRY_LIMIT,
          backoffDelayMs: 0
        }
      };
    }

    // 2. Rule 1: HTTP 500 / 502 / 503 / 504 -> Exponential Backoff Retry
    if ([500, 502, 503, 504].includes(httpCode) || errMessage.includes('timeout') || errMessage.includes('gateway')) {
      const backoffDelayMs = 500 * Math.pow(2, currentRetries - 1); // 500ms, 1000ms, 2000ms
      return {
        actionId,
        idempotencyKey,
        orderNumber: order.orderNumber,
        correlationId: order.correlationId,
        stage,
        actionType: 'EXPONENTIAL_RETRY',
        recommendedAction: 'RETRY_WITH_EXPONENTIAL_BACKOFF',
        riskTier: 'LOW_RISK',
        requiresHumanApproval: false,
        autoHealEligible: true,
        decisionReason: `Transient ${httpCode} network/server error detected. Safe to retry with exponential backoff (${backoffDelayMs}ms).`,
        parameters: {
          attemptNumber: currentRetries,
          maxRetries: MAX_RETRY_LIMIT,
          backoffDelayMs
        }
      };
    }

    // 3. Rule 2: HTTP 429 -> Rate Limit Throttling
    if (httpCode === 429 || errMessage.includes('rate limit')) {
      const backoffDelayMs = 3000;
      return {
        actionId,
        idempotencyKey,
        orderNumber: order.orderNumber,
        correlationId: order.correlationId,
        stage,
        actionType: 'RATE_LIMIT_THROTTLE_RETRY',
        riskTier: 'LOW',
        requiresHumanApproval: false,
        decisionReason: 'HTTP 429 Too Many Requests: Throttling order processing and retrying after permitted cooldown window (3000ms).',
        parameters: {
          attemptNumber: currentRetries,
          maxRetries: MAX_RETRY_LIMIT,
          backoffDelayMs
        }
      };
    }

    // 4. Rule 3: Authentication Errors (HTTP 401 / 403)
    if ([401, 403].includes(httpCode) || errMessage.includes('auth') || errMessage.includes('token')) {
      return {
        actionId,
        idempotencyKey,
        orderNumber: order.orderNumber,
        correlationId: order.correlationId,
        stage,
        actionType: 'TOKEN_REFRESH_RETRY',
        riskTier: 'LOW',
        requiresHumanApproval: false,
        decisionReason: 'Authentication expired in simulated environment. Refreshing simulated bearer token and retrying.',
        parameters: {
          attemptNumber: currentRetries,
          maxRetries: MAX_RETRY_LIMIT,
          backoffDelayMs: 300,
          syntheticCorrection: { tokenRefreshed: true }
        }
      };
    }

    // 5. Rule 4: Fixable Validation Errors (e.g. Inventory local stockout)
    if (errMessage.includes('stock') || errMessage.includes('inventory') || (httpCode === 422 && stage === 'INVENTORY')) {
      return {
        actionId,
        idempotencyKey,
        orderNumber: order.orderNumber,
        correlationId: order.correlationId,
        stage,
        actionType: 'FIXABLE_VALIDATION_CORRECTION',
        riskTier: 'MEDIUM',
        requiresHumanApproval: false,
        decisionReason: 'Hardware inventory shortage at primary depot. Re-routing ONT equipment reservation to Regional Backup Depot.',
        parameters: {
          attemptNumber: currentRetries,
          maxRetries: MAX_RETRY_LIMIT,
          backoffDelayMs: 200,
          syntheticCorrection: { targetDepot: 'Regional-Backup-Depot-East', ontReallocated: true }
        }
      };
    }

    // 6. Rule 5: Hard Business Rejections (Address unserviceable or Payment card decline)
    if (
      failureType === 'ORDER_REJECTION' ||
      errMessage.includes('address') ||
      errMessage.includes('boundary') ||
      errMessage.includes('decline') ||
      errMessage.includes('card')
    ) {
      return {
        actionId,
        idempotencyKey,
        orderNumber: order.orderNumber,
        correlationId: order.correlationId,
        stage,
        actionType: 'ESCALATE_HUMAN_OPERATOR',
        recommendedAction: 'ESCALATE_TO_OPERATOR',
        riskTier: 'HIGH_RISK',
        requiresHumanApproval: true,
        autoHealEligible: false,
        decisionReason: 'Hard business rejection encountered (address unserviceable or card declined). Automatic override forbidden by safety policy.',
        parameters: {
          attemptNumber: currentRetries,
          maxRetries: MAX_RETRY_LIMIT,
          backoffDelayMs: 0
        }
      };
    }

    // 7. Rule 6: Order Delays
    if (order.overallStatus === 'DELAYED' || errMessage.includes('delay') || errMessage.includes('sla')) {
      return {
        actionId,
        idempotencyKey,
        orderNumber: order.orderNumber,
        correlationId: order.correlationId,
        stage,
        actionType: 'QUEUE_PRIORITY_REBALANCE',
        riskTier: 'LOW',
        requiresHumanApproval: false,
        decisionReason: 'Stage latency exceeding baseline SLA. Rebalancing worker priority and applying queue priority boost.',
        parameters: {
          attemptNumber: currentRetries,
          maxRetries: MAX_RETRY_LIMIT,
          backoffDelayMs: 100
        }
      };
    }

    // Fallback safe recommendation
    return {
      actionId,
      idempotencyKey,
      orderNumber: order.orderNumber,
      correlationId: order.correlationId,
      stage,
      actionType: 'ESCALATE_HUMAN_OPERATOR',
      riskTier: 'HIGH',
      requiresHumanApproval: true,
      decisionReason: 'Uncertain failure pattern. Human operator review required before modifying order pipeline.',
      parameters: {
        attemptNumber: currentRetries,
        maxRetries: MAX_RETRY_LIMIT,
        backoffDelayMs: 0
      }
    };
  }

  /**
   * Execute an approved self-healing resolution
   */
  async executeResolution(actionRecord) {
    const startTime = Date.now();
    const order = await storageService.findOrderByIdentifier(actionRecord.orderNumber);

    if (!order) {
      throw new Error(`Order ${actionRecord.orderNumber} not found.`);
    }

    const previousStatus = order.overallStatus;
    const previousStage = order.currentStage;

    // Safety check: Hard business rejections cannot be silently overridden
    if (actionRecord.actionType === 'ESCALATE_HUMAN_OPERATOR') {
      await storageService.updateOrder(order, {
        overallStatus: 'ESCALATED'
      });

      await storageService.updateHealingAction(actionRecord, {
        status: 'ESCALATED',
        executionResult: {
          success: true,
          responseSummary: 'Order escalated to Level-2 Operations Support queue. No automatic pipeline modification.',
          finalOrderStatus: 'ESCALATED',
          executionDurationMs: Date.now() - startTime
        }
      });

      emitEvent('order:escalated', {
        orderNumber: order.orderNumber,
        reason: actionRecord.decisionReason
      });

      return actionRecord;
    }

    try {
      // Update state to HEALING
      await storageService.updateOrder(order, {
        overallStatus: ORDER_STATUSES.HEALING,
        isAutoHealed: true
      });

      emitEvent('order:healing', {
        orderNumber: order.orderNumber,
        actionType: actionRecord.actionType,
        stage: actionRecord.stage
      });

      // Apply backoff delay
      const delay = actionRecord.parameters?.backoffDelayMs || 200;
      await sleep(Math.min(delay, 1000)); // Sleep safely

      // 1. Verify API response & retry stage
      const failingStage = actionRecord.stage;
      const stageIndex = PIPELINE_SEQUENCE.indexOf(failingStage);

      // Stage retry successful event
      await storageService.createOrderEvent({
        orderId: order._id,
        orderNumber: order.orderNumber,
        correlationId: order.correlationId,
        stage: failingStage,
        fromStage: failingStage,
        toStage: failingStage,
        eventType: EVENT_TYPES.STAGE_RETRY,
        httpStatusCode: 200,
        latencyMs: delay,
        metadata: {
          idempotencyKey: actionRecord.idempotencyKey,
          remediationType: actionRecord.actionType,
          syntheticCorrection: actionRecord.parameters?.syntheticCorrection || null
        }
      });

      // 2. Resume subsequent pipeline stages to completion
      for (let i = stageIndex; i < PIPELINE_SEQUENCE.length; i++) {
        const curStage = PIPELINE_SEQUENCE[i];
        const nextStage = i + 1 < PIPELINE_SEQUENCE.length ? PIPELINE_SEQUENCE[i + 1] : 'COMPLETED';

        const metadata = generateTelecomMetadata(curStage, order.plan, order.customer);

        await storageService.createOrderEvent({
          orderId: order._id,
          orderNumber: order.orderNumber,
          correlationId: order.correlationId,
          stage: curStage,
          fromStage: curStage,
          toStage: nextStage,
          eventType: EVENT_TYPES.STAGE_COMPLETED,
          httpStatusCode: 200,
          latencyMs: 120,
          metadata
        });

        await storageService.updateOrder(order, {
          currentStage: nextStage,
          [`stageTimestamps.${curStage.toLowerCase()}CompletedAt`]: new Date()
        });
      }

      // 3. Update order status to COMPLETED
      const totalElapsed = (order.actualProcessingTimeMs || 0) + (Date.now() - startTime);
      await storageService.updateOrder(order, {
        currentStage: 'COMPLETED',
        overallStatus: ORDER_STATUSES.COMPLETED,
        actualProcessingTimeMs: totalElapsed
      });

      // 4. Update Healing Action Audit Record
      await storageService.updateHealingAction(actionRecord, {
        status: 'COMPLETED',
        executionResult: {
          success: true,
          responseSummary: `Successfully healed order at ${failingStage} via ${actionRecord.actionType}. All subsequent stages completed.`,
          resumedStage: failingStage,
          finalOrderStatus: ORDER_STATUSES.COMPLETED,
          executionDurationMs: Date.now() - startTime
        }
      });

      // 5. Update incident status to AUTO_RESOLVED
      const incident = await storageService.findIncidentByIdentifier(order.orderNumber);
      if (incident) {
        await storageService.updateIncident(incident, {
          resolutionStatus: 'AUTO_RESOLVED'
        });
      }

      emitEvent('order:healed', {
        orderNumber: order.orderNumber,
        correlationId: order.correlationId,
        actionId: actionRecord.actionId,
        healedStage: failingStage,
        status: ORDER_STATUSES.COMPLETED
      });

      return actionRecord;
    } catch (err) {
      // Revert/preserve order state
      await storageService.updateOrder(order, {
        overallStatus: previousStatus,
        currentStage: previousStage,
        isAutoHealed: false
      });

      const durationMs = Date.now() - startTime;
      const safeErrorMsg = err.message ? err.message.slice(0, 200) : 'Recovery execution failed unexpectedly';

      // Update HealingAction to FAILED
      await storageService.updateHealingAction(actionRecord, {
        status: 'FAILED',
        executionResult: {
          success: false,
          responseSummary: `Recovery execution failed: ${safeErrorMsg}`,
          resumedStage: actionRecord.stage,
          finalOrderStatus: previousStatus,
          executionDurationMs: durationMs
        }
      });

      emitEvent('order:recovery_failed', {
        orderNumber: order.orderNumber,
        actionId: actionRecord.actionId,
        error: safeErrorMsg
      });

      const cleanError = new Error(`Recovery execution failed: ${safeErrorMsg}`);
      cleanError.statusCode = 500;
      cleanError.actionRecord = actionRecord;
      throw cleanError;
    }
  }
}

module.exports = new RemediationService();
