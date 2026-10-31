const mongoose = require('mongoose');

const DigitalTwinScenarioSchema = new mongoose.Schema({
  predictionId: {
    type: String,
    required: true,
    unique: true,
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
  currentStage: {
    type: String,
    required: true
  },
  elapsedTimeMs: {
    type: Number,
    required: true
  },
  expectedSlaMs: {
    type: Number,
    required: true
  },
  baselineBreachRisk: {
    type: Number,
    required: true
  },
  mlModelBreachProbability: {
    type: Number,
    required: true
  },
  modelAccuracy: {
    type: Number,
    default: 0.94
  },
  isServiceAnomalous: {
    type: Boolean,
    default: false
  },
  safestScenario: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  scenarioComparisons: [
    {
      type: mongoose.Schema.Types.Mixed
    }
  ],
  prescriptiveRecommendation: {
    type: String,
    required: true
  },
  analysisTimestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('DigitalTwinScenario', DigitalTwinScenarioSchema);
