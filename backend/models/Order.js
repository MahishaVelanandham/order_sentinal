const mongoose = require('mongoose');
const { PIPELINE_STAGES, ORDER_STATUSES, ORDER_SCENARIOS } = require('../utils/constants');

const OrderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  correlationId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  customer: {
    customerRef: { type: String, required: true }, // e.g. "CUST-9821"
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    installationAddress: {
      street: String,
      city: String,
      postalCode: String,
      serviceZone: String
    }
  },
  productType: {
    type: String,
    required: true // e.g. "Broadband Fiber 300 Mbps"
  },
  plan: {
    planId: { type: String, required: true },
    planName: { type: String, required: true },
    speedMbps: { type: Number, required: true },
    monthlyFee: { type: Number, required: true }
  },
  scenario: {
    type: String,
    enum: Object.values(ORDER_SCENARIOS),
    default: ORDER_SCENARIOS.SUCCESS,
    index: true
  },
  currentStage: {
    type: String,
    enum: Object.values(PIPELINE_STAGES),
    default: PIPELINE_STAGES.CRM,
    index: true
  },
  overallStatus: {
    type: String,
    enum: Object.values(ORDER_STATUSES),
    default: ORDER_STATUSES.PENDING,
    index: true
  },
  expectedCompletionTimeMs: {
    type: Number,
    required: true,
    default: 2500
  },
  actualProcessingTimeMs: {
    type: Number,
    default: 0
  },
  stageTimestamps: {
    crmStartedAt: Date,
    crmCompletedAt: Date,
    omsStartedAt: Date,
    omsCompletedAt: Date,
    inventoryStartedAt: Date,
    inventoryCompletedAt: Date,
    paymentStartedAt: Date,
    paymentCompletedAt: Date,
    provisioningStartedAt: Date,
    provisioningCompletedAt: Date,
    notificationStartedAt: Date,
    notificationCompletedAt: Date
  },
  slaBreachPredicted: {
    type: Boolean,
    default: false
  },
  slaBreachProbability: {
    type: Number,
    default: 0.0
  },
  failureCount: {
    type: Number,
    default: 0
  },
  failureDetails: {
    stage: String,
    httpStatusCode: Number,
    errorMessage: String,
    failureType: String
  },
  isAutoHealed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Order', OrderSchema);
