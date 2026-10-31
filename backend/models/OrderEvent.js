const mongoose = require('mongoose');
const { PIPELINE_STAGES, EVENT_TYPES } = require('../utils/constants');

const OrderEventSchema = new mongoose.Schema({
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
  stage: {
    type: String,
    enum: Object.values(PIPELINE_STAGES),
    required: true
  },
  fromStage: {
    type: String,
    default: null
  },
  toStage: {
    type: String,
    default: null
  },
  eventType: {
    type: String,
    enum: Object.values(EVENT_TYPES),
    required: true
  },
  httpStatusCode: {
    type: Number,
    default: 200
  },
  latencyMs: {
    type: Number,
    required: true,
    default: 0
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  errorMessage: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = mongoose.model('OrderEvent', OrderEventSchema);
