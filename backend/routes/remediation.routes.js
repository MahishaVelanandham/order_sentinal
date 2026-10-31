const express = require('express');
const router = express.Router();
const {
  getRecommendations,
  approveResolution,
  rejectRecommendation,
  retryOrder,
  escalateOrder,
  getResolutionHistory
} = require('../controllers/remediation.controller');

/**
 * @route   GET /api/remediation/recommendations/:orderId
 * @desc    Get recommended resolution with idempotency key & risk tier
 * @access  Public
 */
router.get('/recommendations/:orderId', getRecommendations);

/**
 * @route   POST /api/remediation/approve/:actionId
 * @desc    Approve and execute a recommended resolution
 * @access  Public
 */
router.post('/approve/:actionId', approveResolution);

/**
 * @route   POST /api/remediation/reject/:actionId
 * @desc    Reject a recommendation and escalate to operations
 * @access  Public
 */
router.post('/reject/:actionId', rejectRecommendation);

/**
 * @route   POST /api/remediation/retry/:orderId
 * @desc    Directly retry an order with exponential backoff & idempotency
 * @access  Public
 */
router.post('/retry/:orderId', retryOrder);

/**
 * @route   POST /api/remediation/escalate/:orderId
 * @desc    Escalate an order to human operators
 * @access  Public
 */
router.post('/escalate/:orderId', escalateOrder);

/**
 * @route   GET /api/remediation/history
 * @desc    Retrieve complete resolution audit trail
 * @access  Public
 */
router.get('/history', getResolutionHistory);

module.exports = router;
