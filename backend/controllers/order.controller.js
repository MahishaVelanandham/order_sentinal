const orderSimulationEngine = require('../services/orderSimulation.service');
const storageService = require('../services/storage.service');
const { ORDER_SCENARIOS } = require('../utils/constants');

/**
 * Generate synthetic broadband order(s)
 * POST /api/orders/generate
 */
const generateOrders = async (req, res, next) => {
  try {
    const {
      scenario = ORDER_SCENARIOS.SUCCESS,
      count = 1,
      async = false,
      customer,
      plan,
      failureCount
    } = req.body;

    const parsedCount = Math.min(Math.max(parseInt(count, 10) || 1, 1), 20);
    const validScenarios = Object.values(ORDER_SCENARIOS);

    const generated = [];

    for (let i = 0; i < parsedCount; i++) {
      let chosenScenario = scenario.toUpperCase();
      if (chosenScenario === 'RANDOM') {
        chosenScenario = validScenarios[Math.floor(Math.random() * validScenarios.length)];
      }

      const order = await orderSimulationEngine.generateAndProcessOrder({
        scenario: chosenScenario,
        customCustomer: customer,
        customPlan: plan,
        asyncMode: Boolean(async),
        failureCount: failureCount !== undefined ? Number(failureCount) : undefined
      });
      generated.push(order);
    }

    res.status(201).json({
      success: true,
      message: `Generated and simulated ${parsedCount} synthetic broadband order(s)`,
      count: generated.length,
      data: parsedCount === 1 ? generated[0] : generated,
      orders: generated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all orders with filtering and status summary
 * GET /api/orders
 */
const getOrders = async (req, res, next) => {
  try {
    const {
      status,
      stage,
      scenario,
      limit = 50,
      skip = 0
    } = req.query;

    const filter = {};
    if (status) filter.overallStatus = status.toUpperCase();
    if (stage) filter.currentStage = stage.toUpperCase();
    if (scenario) filter.scenario = scenario.toUpperCase();

    const { data: orders, total } = await storageService.findOrders(filter, {
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10)
    });

    const statusSummary = await storageService.getStatusSummary();

    res.status(200).json({
      success: true,
      summary: statusSummary,
      pagination: {
        total,
        limit: parseInt(limit, 10),
        skip: parseInt(skip, 10),
        returned: orders.length
      },
      data: orders
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single order by MongoDB _id, orderNumber, or correlationId
 * GET /api/orders/:id
 */
const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await storageService.findOrderByIdentifier(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found with identifier: '${id}'`
      });
    }

    res.status(200).json({
      success: true,
      order,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get full chronological timeline events for an order
 * GET /api/orders/:id/timeline
 */
const getOrderTimeline = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await storageService.findOrderByIdentifier(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order not found with identifier: '${id}'`
      });
    }

    const events = await storageService.findEventsByOrder(order);

    res.status(200).json({
      success: true,
      orderNumber: order.orderNumber,
      correlationId: order.correlationId,
      overallStatus: order.overallStatus,
      currentStage: order.currentStage,
      totalEvents: events.length,
      timeline: events
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateOrders,
  getOrders,
  getOrderById,
  getOrderTimeline
};
