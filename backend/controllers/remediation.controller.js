const crypto = require('crypto');
const storageService = require('../services/storage.service');
const remediationService = require('../services/remediation.service');
const { emitEvent } = require('../services/socket.service');

/**
 * 1. Get recommended resolutions for an order
 * GET /api/remediation/recommendations/:orderId
 */
const getRecommendations = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const order = await storageService.findOrderByIdentifier(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found with identifier: '${orderId}'`
      });
    }

    const recommendation = remediationService.recommendResolution(order, order.failureDetails || {});

    // Save as RECOMMENDED action in database
    const actionRecord = await storageService.createHealingAction(recommendation);

    res.status(200).json({
      success: true,
      recommendation: actionRecord,
      data: actionRecord
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Approve and execute a resolution (Human-in-the-loop approval gate)
 * POST /api/remediation/approve/:actionId
 */
const approveResolution = async (req, res, next) => {
  try {
    const { actionId } = req.params;
    const action = await storageService.findHealingActionByIdOrKey(actionId);

    if (!action) {
      return res.status(404).json({
        success: false,
        message: `Healing action not found with identifier: '${actionId}'`
      });
    }

    if (action.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Action has already been executed and completed.'
      });
    }

    await storageService.updateHealingAction(action, {
      status: 'APPROVED'
    });

    // Execute the resolution
    const executed = await remediationService.executeResolution(action);

    res.status(200).json({
      success: true,
      message: `Resolution ${action.actionType} approved and executed successfully.`,
      data: executed
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Reject a recommended resolution
 * POST /api/remediation/reject/:actionId
 */
const rejectRecommendation = async (req, res, next) => {
  try {
    const { actionId } = req.params;
    const { reason = 'Rejected by operations supervisor' } = req.body;

    const action = await storageService.findHealingActionByIdOrKey(actionId);

    if (!action) {
      return res.status(404).json({
        success: false,
        message: `Healing action not found with identifier: '${actionId}'`
      });
    }

    await storageService.updateHealingAction(action, {
      status: 'REJECTED',
      'parameters.operatorNotes': reason
    });

    const order = await storageService.findOrderByIdentifier(action.orderNumber);
    if (order) {
      await storageService.updateOrder(order, {
        overallStatus: 'ESCALATED'
      });
    }

    const incident = await storageService.findIncidentByIdentifier(action.orderNumber);
    if (incident) {
      await storageService.updateIncident(incident, {
        resolutionStatus: 'ESCALATED'
      });
    }

    emitEvent('remediation:rejected', {
      actionId: action.actionId,
      orderNumber: action.orderNumber,
      reason
    });

    res.status(200).json({
      success: true,
      message: 'Recommendation rejected. Order marked for manual operator intervention.',
      data: action
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Retry an order directly
 * POST /api/remediation/retry/:orderId
 */
const retryOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const order = await storageService.findOrderByIdentifier(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found with identifier: '${orderId}'`
      });
    }

    // TASK 1: Prevent retries on completed or terminal state orders
    if (order.overallStatus === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Completed orders cannot be retried.'
      });
    }

    if (order.overallStatus === 'REJECTED') {
      return res.status(400).json({
        success: false,
        message: 'Hard business rejected orders cannot be retried automatically. Human operator intervention is required.'
      });
    }

    if (order.overallStatus === 'ESCALATED') {
      return res.status(400).json({
        success: false,
        message: 'Escalated orders cannot be retried automatically. Human operator review is required.'
      });
    }

    if (order.overallStatus === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Cancelled orders cannot be retried.'
      });
    }

    const currentRetries = (order.failureCount || 0) + 1;

    // TASK 2: Safety - Prevent infinite loops & record audit log when MAX_RETRY_LIMIT is exceeded
    if (currentRetries > 3) {
      await storageService.updateOrder(order, { overallStatus: 'ESCALATED' });

      const actionId = `ACT-LIMIT-${Date.now().toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const escalationAction = await storageService.createHealingAction({
        actionId,
        idempotencyKey: `IDEM-${order.orderNumber}-${order.currentStage || 'PAYMENT'}-ATTEMPT-${currentRetries}-REJECTED`,
        orderId: order._id,
        orderNumber: order.orderNumber,
        correlationId: order.correlationId,
        stage: order.currentStage || 'UNKNOWN',
        actionType: 'ESCALATE_HUMAN_OPERATOR',
        riskTier: 'HIGH',
        requiresHumanApproval: true,
        status: 'ESCALATED',
        decisionReason: 'MAX_RETRY_LIMIT_EXCEEDED: Maximum retry limit of 3 exceeded. Order escalated to prevent infinite retry loops.',
        parameters: {
          attemptNumber: currentRetries,
          maxRetries: 3,
          backoffDelayMs: 0,
          reason: 'MAX_RETRY_LIMIT_EXCEEDED'
        },
        executionResult: {
          success: false,
          responseSummary: 'Retry rejected: Maximum retry limit of 3 exceeded. Order escalated to Level-2 Operations.',
          finalOrderStatus: 'ESCALATED',
          executionDurationMs: 0
        }
      });

      emitEvent('order:escalated', {
        orderNumber: order.orderNumber,
        reason: 'MAX_RETRY_LIMIT_EXCEEDED'
      });

      return res.status(400).json({
        success: false,
        message: 'Max retry limit of 3 exceeded. Order has been escalated to prevent infinite retry loops.',
        auditRecord: escalationAction,
        data: escalationAction
      });
    }

    await storageService.updateOrder(order, { failureCount: currentRetries });

    // Generate recommendation & execute immediately if low-risk
    const rec = remediationService.recommendResolution(order, order.failureDetails || {});
    const actionRecord = await storageService.createHealingAction(rec);

    const executed = await remediationService.executeResolution(actionRecord);

    res.status(200).json({
      success: true,
      message: `Order ${order.orderNumber} retried successfully via ${rec.actionType}`,
      data: executed
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Escalate an order to human operators
 * POST /api/remediation/escalate/:orderId
 */
const escalateOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { reason = 'Manual operator escalation requested' } = req.body;

    const order = await storageService.findOrderByIdentifier(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found with identifier: '${orderId}'`
      });
    }

    await storageService.updateOrder(order, {
      overallStatus: 'ESCALATED'
    });

    const incident = await storageService.findIncidentByIdentifier(order.orderNumber);
    if (incident) {
      await storageService.updateIncident(incident, {
        resolutionStatus: 'ESCALATED'
      });
    }

    const actionId = `ACT-ESC-${Date.now().toString().slice(-6)}`;
    const action = await storageService.createHealingAction({
      actionId,
      idempotencyKey: `IDEM-ESC-${order.orderNumber}`,
      orderId: order._id,
      orderNumber: order.orderNumber,
      correlationId: order.correlationId,
      stage: order.currentStage,
      actionType: 'ESCALATE_HUMAN_OPERATOR',
      riskTier: 'HIGH',
      requiresHumanApproval: true,
      status: 'ESCALATED',
      decisionReason: reason,
      parameters: { operatorNotes: reason },
      executionResult: {
        success: true,
        responseSummary: `Order manually escalated: ${reason}`,
        finalOrderStatus: 'ESCALATED',
        executionDurationMs: 0
      }
    });

    emitEvent('order:escalated', {
      orderNumber: order.orderNumber,
      reason
    });

    res.status(200).json({
      success: true,
      message: `Order ${order.orderNumber} successfully escalated to operations queue.`,
      data: action
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 6. View resolution history (Audit Log)
 * GET /api/remediation/history
 */
const getResolutionHistory = async (req, res, next) => {
  try {
    const { orderNumber, status, limit = 50, skip = 0 } = req.query;
    const filter = {};
    if (orderNumber) filter.orderNumber = orderNumber;
    if (status) filter.status = status.toUpperCase();

    const { data: actions, total } = await storageService.findHealingActions(filter, {
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10)
    });

    res.status(200).json({
      success: true,
      pagination: {
        total,
        limit: parseInt(limit, 10),
        skip: parseInt(skip, 10),
        returned: actions.length
      },
      data: actions
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRecommendations,
  approveResolution,
  rejectRecommendation,
  retryOrder,
  escalateOrder,
  getResolutionHistory
};
