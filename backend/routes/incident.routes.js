const express = require('express');
const router = express.Router();
const {
  detectOrderFailure,
  runOrderRCA,
  getOrderRCA,
  getIncidents,
  getHealingActions,
  resolveManualIncident
} = require('../controllers/incident.controller');

/**
 * @route   POST /api/incidents/detect/:id
 * @desc    Run AI failure detection on order timeline events & store incident
 * @access  Public
 */
router.post('/detect/:id', detectOrderFailure);

/**
 * @route   POST /api/incidents/rca/:id
 * @desc    Run comprehensive Root Cause Analysis (RCA) on an order
 * @access  Public
 */
router.post('/rca/:id', runOrderRCA);

/**
 * @route   GET /api/incidents/rca/:id
 * @desc    Retrieve Root Cause Analysis result for an order/incident
 * @access  Public
 */
router.get('/rca/:id', getOrderRCA);

/**
 * @route   GET /api/incidents
 * @desc    Retrieve detected failure incidents with filtering
 * @access  Public
 */
router.get('/', getIncidents);

/**
 * @route   GET /api/incidents/healing-actions
 * @desc    Retrieve healing action history
 * @access  Public
 */
router.get('/healing-actions', getHealingActions);

/**
 * @route   POST /api/incidents/:id/resolve
 * @desc    Manually resolve an incident
 * @access  Public
 */
router.post('/:id/resolve', resolveManualIncident);

module.exports = router;
