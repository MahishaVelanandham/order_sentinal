"""
Predictive Digital Twin Simulation Engine
Creates a virtual software representation of an in-flight broadband order.
Simulates What-If scenarios before failures occur and prescribes the safest preventative action.
"""
from datetime import datetime, timezone
from typing import List, Dict, Any
from models.schemas import (
    TwinOrderPredictionRequest,
    TwinOrderPredictionResponse,
    ScenarioComparison,
    TwinSimulationRequest,
    TwinSimulationResponse,
    BaselineMetrics,
    SimulatedMetrics,
    PrescriptiveRecommendation
)
from models.sla_ml_model import sla_ml_model, STAGE_INDICES
from models.isolation_forest_model import isolation_forest_detector

# Average nominal processing durations per stage
STAGE_NOMINAL_DURATIONS_MS = {
    'CRM': 120.0,
    'ORDER_MANAGEMENT': 150.0,
    'INVENTORY': 200.0,
    'PAYMENT': 250.0,
    'PROVISIONING': 450.0,
    'NOTIFICATION': 100.0
}

PIPELINE_ORDER = ['CRM', 'ORDER_MANAGEMENT', 'INVENTORY', 'PAYMENT', 'PROVISIONING', 'NOTIFICATION']

class TwinService:
    @classmethod
    def predict_and_simulate_order(cls, req: TwinOrderPredictionRequest) -> TwinOrderPredictionResponse:
        """
        Predicts SLA breach risk and runs 3 What-If scenarios for an in-flight order.
        Strictly decoupled from actual order execution (purely virtual simulation).
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        cur_stage = req.currentStage.upper()
        cur_stage_idx = STAGE_INDICES.get(cur_stage, 0)
        elapsed = req.elapsedTimeMs
        expected_sla = req.expectedSlaMs

        # 1. Unusual service behaviour check via Isolation Forest
        anomaly_check = isolation_forest_detector.evaluate_latency_anomaly(
            stage=cur_stage,
            latency_ms=req.currentApiLatencyMs,
            http_status_code=200
        )
        is_anomalous = anomaly_check["isAnomaly"]

        # Calculate remaining baseline stage duration
        remaining_stages = PIPELINE_ORDER[cur_stage_idx + 1:] if cur_stage_idx < 5 else []
        remaining_base_ms = sum(STAGE_NOMINAL_DURATIONS_MS.get(s, 200.0) for s in remaining_stages)

        # Baseline Risk Model (Queueing theory heuristic)
        current_stage_rem = max(STAGE_NOMINAL_DURATIONS_MS.get(cur_stage, 200.0) - 50.0, 50.0)
        baseline_proj_rem = current_stage_rem + remaining_base_ms + req.queueDelayMs + (req.retryCount * 400.0)
        baseline_total = elapsed + baseline_proj_rem
        breach_margin = baseline_total - expected_sla
        baseline_risk = min(max(0.05 + (breach_margin / expected_sla) * 1.2, 0.02), 0.98)

        # -------------------------------------------------------------
        # 2. What-If Scenario A: Continue using current service
        # -------------------------------------------------------------
        # Subject to current service congestion, queue depth, and health
        health_factor = max(2.0 - req.serviceHealthScore, 1.0)
        scenario_a_rem = (current_stage_rem + remaining_base_ms) * health_factor + req.queueDelayMs
        scenario_a_total = elapsed + scenario_a_rem

        ml_prob_a = sla_ml_model.predict_breach_probability({
            "currentStage": cur_stage,
            "elapsedTimeMs": elapsed,
            "expectedSlaMs": expected_sla,
            "currentApiLatencyMs": req.currentApiLatencyMs,
            "queueDelayMs": req.queueDelayMs,
            "retryCount": req.retryCount,
            "serviceFailureRate": req.serviceFailureRate,
            "serviceHealthScore": req.serviceHealthScore
        })

        scenario_a = ScenarioComparison(
            scenarioKey="SCENARIO_A",
            name="Scenario A: Continue Current Service Route",
            description="Proceed along the default active microservice path with current queue backpressure.",
            estimatedProcessingTimeMs=round(scenario_a_rem, 1),
            predictedSlaBreachRisk=round(ml_prob_a, 3),
            expectedTotalDurationMs=round(scenario_a_total, 1),
            recommendedAction="Continue standard path only if stage queue latency remains within threshold.",
            isSafest=False
        )

        # -------------------------------------------------------------
        # 3. What-If Scenario B: Retry after a short backoff (500ms)
        # -------------------------------------------------------------
        # Cooldown allows queue backlog to dissipate by ~35%
        backoff_cooldown_ms = 500.0
        reduced_queue_ms = req.queueDelayMs * 0.65
        scenario_b_rem = (current_stage_rem + remaining_base_ms) + reduced_queue_ms + backoff_cooldown_ms
        scenario_b_total = elapsed + scenario_b_rem

        ml_prob_b = sla_ml_model.predict_breach_probability({
            "currentStage": cur_stage,
            "elapsedTimeMs": elapsed,
            "expectedSlaMs": expected_sla,
            "currentApiLatencyMs": req.currentApiLatencyMs * 0.85,
            "queueDelayMs": reduced_queue_ms,
            "retryCount": req.retryCount,
            "serviceFailureRate": req.serviceFailureRate * 0.8,
            "serviceHealthScore": min(req.serviceHealthScore + 0.1, 1.0)
        })

        scenario_b = ScenarioComparison(
            scenarioKey="SCENARIO_B",
            name="Scenario B: Retry After 500ms Backoff Cooldown",
            description="Pause execution briefly to allow worker thread pool starvation and queue depth to normalize.",
            estimatedProcessingTimeMs=round(scenario_b_rem, 1),
            predictedSlaBreachRisk=round(ml_prob_b, 3),
            expectedTotalDurationMs=round(scenario_b_total, 1),
            recommendedAction="Apply 500ms backoff cooldown to let upstream worker queues clear.",
            isSafest=False
        )

        # -------------------------------------------------------------
        # 4. What-If Scenario C: Route through simulated healthy backup gateway
        # -------------------------------------------------------------
        # Switch traffic to secondary standby cluster (nominal health 0.98, queue < 25ms, switch overhead 80ms)
        switch_overhead_ms = 80.0
        backup_queue_ms = 25.0
        scenario_c_rem = remaining_base_ms + backup_queue_ms + switch_overhead_ms + 100.0
        scenario_c_total = elapsed + scenario_c_rem

        ml_prob_c = sla_ml_model.predict_breach_probability({
            "currentStage": cur_stage,
            "elapsedTimeMs": elapsed,
            "expectedSlaMs": expected_sla,
            "currentApiLatencyMs": 120.0,  # nominal latency on backup gateway
            "queueDelayMs": backup_queue_ms,
            "retryCount": req.retryCount,
            "serviceFailureRate": 0.01,
            "serviceHealthScore": 0.98
        })

        scenario_c = ScenarioComparison(
            scenarioKey="SCENARIO_C",
            name="Scenario C: Route Through Healthy Standby Gateway",
            description="Proactively divert downstream tasks to the idle backup gateway cluster with minimal queue delay.",
            estimatedProcessingTimeMs=round(scenario_c_rem, 1),
            predictedSlaBreachRisk=round(ml_prob_c, 3),
            expectedTotalDurationMs=round(scenario_c_total, 1),
            recommendedAction="Safest proactive action: Reroute in-flight tasks through standby cluster.",
            isSafest=False
        )

        # -------------------------------------------------------------
        # 5. Select the Safest Feasible Scenario
        # -------------------------------------------------------------
        all_scenarios = [scenario_a, scenario_b, scenario_c]
        # Sort by predicted SLA breach risk ascending
        all_scenarios.sort(key=lambda s: s.predictedSlaBreachRisk)
        safest = all_scenarios[0]
        safest.isSafest = True

        # Generate prescriptive recommendation
        if safest.scenarioKey == "SCENARIO_C":
            prescriptive = (
                f"Digital Twin Recommendation: Reroute via Backup Gateway (Scenario C). "
                f"SLA breach probability drops from {round(ml_prob_a * 100, 1)}% down to {round(ml_prob_c * 100, 1)}%."
            )
        elif safest.scenarioKey == "SCENARIO_B":
            prescriptive = (
                f"Digital Twin Recommendation: Apply 500ms Backoff Cooldown (Scenario B). "
                f"Reduces queue backpressure while keeping expected completion within nominal SLA."
            )
        else:
            prescriptive = (
                f"Digital Twin Recommendation: Continue on Current Path (Scenario A). "
                f"System latency is healthy with minimal breach risk ({round(ml_prob_a * 100, 1)}%)."
            )

        # Re-index to standard order [A, B, C] for consistent UI presentation
        scenario_map = {s.scenarioKey: s for s in [scenario_a, scenario_b, scenario_c]}
        ordered_scenarios = [scenario_map["SCENARIO_A"], scenario_map["SCENARIO_B"], scenario_map["SCENARIO_C"]]

        return TwinOrderPredictionResponse(
            orderNumber=req.orderNumber,
            correlationId=req.correlationId,
            currentStage=cur_stage,
            elapsedTimeMs=round(elapsed, 1),
            expectedSlaMs=round(expected_sla, 1),
            baselineBreachRisk=round(baseline_risk, 3),
            mlModelBreachProbability=round(ml_prob_a, 3),
            modelAccuracy=sla_ml_model.metrics["accuracy"],
            isServiceAnomalous=is_anomalous,
            safestScenario=safest,
            scenarioComparisons=ordered_scenarios,
            prescriptiveRecommendation=prescriptive,
            analysisTimestamp=now_iso
        )

    # Legacy simulation endpoint (retained for cluster-level What-If simulations)
    @staticmethod
    def run_simulation(request: TwinSimulationRequest) -> TwinSimulationResponse:
        multiplier = request.orderArrivalMultiplier
        added_delay = request.injectedStageDelayMs.addedDelay if request.injectedStageDelayMs else 0.0

        baseline = BaselineMetrics(
            totalOrdersSimulated=500,
            baselineSlaBreachRate=0.038,
            avgCycleTimeSeconds=5.4
        )

        simulated_breach_rate = min(baseline.baselineSlaBreachRate * (multiplier ** 1.8) + (added_delay / 10000.0), 0.95)
        simulated_queue_spike = int(25 * multiplier + (added_delay / 200.0))

        simulated = SimulatedMetrics(
            predictedSlaBreachRate=round(simulated_breach_rate, 3),
            predictedBottleneckStage="PROVISIONING" if added_delay > 0 else "INVENTORY",
            projectedQueueSpike=simulated_queue_spike
        )

        recommendations = [
            PrescriptiveRecommendation(
                action="Dynamically scale Provisioning worker concurrency pool from 4 to 8 instances",
                expectedSlaRiskReduction=round(simulated_breach_rate * 0.65, 3),
                safetyRank=1
            ),
            PrescriptiveRecommendation(
                action="Enable predictive rate-limiting on non-priority batch residential orders",
                expectedSlaRiskReduction=round(simulated_breach_rate * 0.40, 3),
                safetyRank=2
            )
        ]

        return TwinSimulationResponse(
            baselineMetrics=baseline,
            simulatedMetrics=simulated,
            prescriptiveRecommendations=recommendations
        )
