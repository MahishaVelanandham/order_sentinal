const mongoose = require('mongoose');

const IncidentLogSchema = new mongoose.Schema({
  incidentId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  orderNumber: {
    type: String,
    required: true,
    index: true
  },
  correlationId: {
    type: String,
    required: true,
    index: true
  },
  failureCategory: {
    type: String,
    enum: ['API_RESPONSE_ERROR', 'ORDER_DELAY', 'ORDER_REJECTION', 'NONE'],
    required: true,
    index: true
  },
  failureReason: {
    type: String,
    required: true
  },
  affectedService: {
    type: String,
    required: true,
    index: true
  },
  severity: {
    type: String,
    enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'],
    required: true
  },
  supportingEvidence: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  rcaDetails: {
    failedStage: String,
    failureSummary: String,
    rootCauseExplanation: String,
    possibleReasons: [String],
    previousStages: [
      {
        stage: String,
        status: String,
        httpStatusCode: Number,
        latencyMs: Number
      }
    ],
    affectedDownstreamServices: [String],
    recommendedAction: String,
    riskTier: String,
    confidenceScore: Number,
    analysisTimestamp: Date,
    supportingEvidence: mongoose.Schema.Types.Mixed
  },
  resolutionStatus: {
    type: String,
    enum: ['OPEN', 'PENDING', 'IN_REMEDIATION', 'AUTO_RESOLVED', 'RESOLVED', 'ESCALATED', 'FAILED_REMEDIATION'],
    default: 'OPEN',
    index: true
  },
  detectionTimestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('IncidentLog', IncidentLogSchema);
