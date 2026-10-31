const mongoose = require('mongoose');

const HealingActionSchema = new mongoose.Schema({
  actionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  idempotencyKey: {
    type: String,
    required: true,
    index: true
  },
  incidentId: {
    type: String,
    index: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  orderNumber: {
    type: String,
    required: true,
    index: true
  },
  correlationId: {
    type: String,
    required: true
  },
  stage: {
    type: String,
    required: true
  },
  actionType: {
    type: String,
    enum: [
      'EXPONENTIAL_RETRY',
      'RATE_LIMIT_THROTTLE_RETRY',
      'TOKEN_REFRESH_RETRY',
      'FIXABLE_VALIDATION_CORRECTION',
      'ESCALATE_HUMAN_OPERATOR',
      'QUEUE_PRIORITY_REBALANCE',
      'MANUAL_ENGINEER_DISPATCH'
    ],
    required: true
  },
  riskTier: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'LOW_RISK', 'MEDIUM_RISK', 'HIGH_RISK'],
    default: 'LOW'
  },
  requiresHumanApproval: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['RECOMMENDED', 'APPROVED', 'REJECTED', 'EXECUTING', 'COMPLETED', 'FAILED', 'ESCALATED'],
    default: 'RECOMMENDED',
    index: true
  },
  decisionReason: {
    type: String,
    required: true
  },
  parameters: {
    attemptNumber: { type: Number, default: 1 },
    maxRetries: { type: Number, default: 3 },
    backoffDelayMs: { type: Number, default: 500 },
    syntheticCorrection: mongoose.Schema.Types.Mixed,
    operatorNotes: String
  },
  executionResult: {
    success: { type: Boolean, default: false },
    responseSummary: String,
    resumedStage: String,
    finalOrderStatus: String,
    executionDurationMs: Number
  },
  performedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('HealingAction', HealingActionSchema);
