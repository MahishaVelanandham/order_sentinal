/**
 * Fault Injection (Chaos) Service
 * Allows intentional triggering of API response errors (500, 504),
 * processing delays, validation rejections, and stuck pipelines.
 */
class ChaosService {
  constructor() {
    this.rules = {
      enabled: false,
      targetStage: 'ANY', // 'CRM', 'ORDER_MANAGEMENT', 'INVENTORY', 'PAYMENT', 'PROVISIONING', 'NOTIFICATION', 'ANY'
      faultType: 'NONE',  // 'API_ERROR_500', 'API_ERROR_504', 'DELAY', 'REJECTION', 'STUCK'
      delayMs: 3000,
      failureProbability: 1.0,
      notes: 'No chaos fault currently injected'
    };
  }

  getRules() {
    return { ...this.rules };
  }

  setRules(updated) {
    this.rules = {
      ...this.rules,
      ...updated,
      enabled: updated.enabled !== undefined ? Boolean(updated.enabled) : true
    };
    return this.getRules();
  }

  resetRules() {
    this.rules = {
      enabled: false,
      targetStage: 'ANY',
      faultType: 'NONE',
      delayMs: 3000,
      failureProbability: 1.0,
      notes: 'All faults reset to baseline normal'
    };
    return this.getRules();
  }

  /**
   * Determine if a fault applies to a given stage and order scenario
   */
  evaluateStageFault(stage, orderScenario = 'SUCCESS') {
    // 1. Check if order was created with an explicit scenario override
    if (orderScenario === 'API_ERROR') {
      // Pick a realistic stage if not specified
      if (stage === 'PAYMENT' || stage === 'PROVISIONING') {
        const is504 = stage === 'PAYMENT';
        return {
          triggered: true,
          faultType: is504 ? 'API_ERROR_504' : 'API_ERROR_500',
          httpStatusCode: is504 ? 504 : 500,
          delayMs: is504 ? 2000 : 800,
          errorMessage: is504
            ? `504 Gateway Timeout: Payment Vendor Gateway did not respond within 2000ms SLA`
            : `500 Internal Server Error: Provisioning OLT Switch service encountered unhandled null reference`
        };
      }
    } else if (orderScenario === 'DELAY') {
      if (stage === 'PROVISIONING' || stage === 'ORDER_MANAGEMENT') {
        return {
          triggered: true,
          faultType: 'DELAY',
          httpStatusCode: 200,
          delayMs: 3500, // Massive delay exceeding normal SLA
          errorMessage: `SLA Breach Warning: Stage processing latency (3500ms) exceeded threshold`
        };
      }
    } else if (orderScenario === 'REJECTION') {
      if (stage === 'INVENTORY' || stage === 'CRM') {
        const isCRM = stage === 'CRM';
        return {
          triggered: true,
          faultType: 'REJECTION',
          httpStatusCode: 422,
          delayMs: 300,
          errorMessage: isCRM
            ? `422 Unprocessable Entity: Customer address outside optical fiber service zone boundary`
            : `422 Unprocessable Entity: ONT Optical Router hardware stock depleted in regional distribution center`
        };
      }
    } else if (orderScenario === 'STUCK') {
      if (stage === 'PROVISIONING') {
        return {
          triggered: true,
          faultType: 'STUCK',
          httpStatusCode: 408,
          delayMs: 1500,
          errorMessage: `Pipeline Stalled: Worker thread deadlocked while reserving OLT PON optical port`
        };
      }
    }

    // 2. Check if global Chaos Injection is enabled
    if (this.rules.enabled) {
      const stageMatches = this.rules.targetStage === 'ANY' || this.rules.targetStage === stage;
      const rollDice = Math.random() <= this.rules.failureProbability;

      if (stageMatches && rollDice) {
        switch (this.rules.faultType) {
          case 'API_ERROR_504':
            return {
              triggered: true,
              faultType: 'API_ERROR_504',
              httpStatusCode: 504,
              delayMs: 2500,
              errorMessage: `[Injected Fault] 504 Gateway Timeout at ${stage} API Endpoint`
            };
          case 'API_ERROR_500':
            return {
              triggered: true,
              faultType: 'API_ERROR_500',
              httpStatusCode: 500,
              delayMs: 900,
              errorMessage: `[Injected Fault] 500 Internal Server Error at ${stage} microservice`
            };
          case 'DELAY':
            return {
              triggered: true,
              faultType: 'DELAY',
              httpStatusCode: 200,
              delayMs: this.rules.delayMs || 3000,
              errorMessage: `[Injected Fault] Artificial Latency Spike (${this.rules.delayMs || 3000}ms) at ${stage}`
            };
          case 'REJECTION':
            return {
              triggered: true,
              faultType: 'REJECTION',
              httpStatusCode: 422,
              delayMs: 400,
              errorMessage: `[Injected Fault] Business Validation Rejection at ${stage}`
            };
          case 'STUCK':
            return {
              triggered: true,
              faultType: 'STUCK',
              httpStatusCode: 408,
              delayMs: 1200,
              errorMessage: `[Injected Fault] Pipeline execution stalled between ${stage} and next stage`
            };
          default:
            break;
        }
      }
    }

    return { triggered: false };
  }
}

module.exports = new ChaosService();
