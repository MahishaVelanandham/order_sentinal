const chaosService = require('../services/chaos.service');
const { emitEvent } = require('../services/socket.service');

/**
 * Get current chaos fault injection settings
 * GET /api/chaos
 */
const getChaosStatus = (req, res) => {
  const rules = chaosService.getRules();
  res.status(200).json({
    success: true,
    data: rules
  });
};

/**
 * Update chaos fault injection rules
 * POST /api/chaos/inject
 */
const updateChaosRules = (req, res) => {
  const updated = chaosService.setRules(req.body);
  emitEvent('chaos:updated', updated);

  res.status(200).json({
    success: true,
    message: 'Fault injection rules applied successfully',
    data: updated
  });
};

/**
 * Reset all chaos rules to baseline normal
 * POST /api/chaos/reset
 */
const resetChaosRules = (req, res) => {
  const reset = chaosService.resetRules();
  emitEvent('chaos:updated', reset);

  res.status(200).json({
    success: true,
    message: 'All injected faults reset to baseline',
    data: reset
  });
};

module.exports = {
  getChaosStatus,
  updateChaosRules,
  resetChaosRules
};
