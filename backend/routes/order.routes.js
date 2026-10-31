const express = require('express');
const router = express.Router();
const {
  generateOrders,
  getOrders,
  getOrderById,
  getOrderTimeline
} = require('../controllers/order.controller');

/**
 * @route   POST /api/orders/generate
 * @desc    Generate and simulate synthetic broadband orders across scenarios
 * @access  Public
 */
router.post('/generate', generateOrders);

/**
 * @route   GET /api/orders
 * @desc    Get all orders with optional stage/status/scenario filters
 * @access  Public
 */
router.get('/', getOrders);

/**
 * @route   GET /api/orders/:id
 * @desc    Get order by MongoDB _id, orderNumber, or correlationId
 * @access  Public
 */
router.get('/:id', getOrderById);

/**
 * @route   GET /api/orders/:id/timeline
 * @desc    Get full chronological stage transition event timeline for an order
 * @access  Public
 */
router.get('/:id/timeline', getOrderTimeline);

module.exports = router;
