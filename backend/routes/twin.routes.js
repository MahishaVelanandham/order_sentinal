const express = require('express');
const router = express.Router();
const {
  predictOrderDigitalTwin,
  getTwinHistory,
  runSimulation
} = require('../controllers/twin.controller');

/**
 * @route   POST /api/twin/predict/:orderId
 * @desc    Simulate What-If scenarios & predict SLA breach risk for an in-flight order
 * @access  Public
 */
router.post('/predict/:orderId', predictOrderDigitalTwin);

/**
 * @route   GET /api/twin/history
 * @desc    Get Digital Twin simulation and prediction history
 * @access  Public
 */
router.get('/history', getTwinHistory);

/**
 * @route   POST /api/twin/simulate
 * @desc    Run cluster-level What-If load surge simulation
 * @access  Public
 */
router.post('/simulate', runSimulation);

module.exports = router;
