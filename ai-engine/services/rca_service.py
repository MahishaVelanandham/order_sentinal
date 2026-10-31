"""
Root Cause Analysis (RCA) Engine
Performs evidence-based diagnosis of failed telecom broadband orders.
Analyzes stage timelines, API logs, previous states, and downstream service impacts.
"""
from datetime import datetime, timezone
from typing import Dict, Any, List
from models.schemas import (
    RCAPipelineRequest,
    RCAPipelineResponse,
    StageStateSummary,
    RCAPredictionRequest,
    RCAPredictionResponse
)

PIPELINE_SEQUENCE = [
    'CRM',
    'ORDER_MANAGEMENT',
    'INVENTORY',
    'PAYMENT',
    'PROVISIONING',
    'NOTIFICATION'
]

class RCAService:
    @classmethod
    def analyze_order_failure(cls, request: RCAPipelineRequest) -> RCAPipelineResponse:
        timeline = request.timeline or []
        order_number = request.orderNumber
        correlation_id = request.correlationId
        overall_status = request.overallStatus.upper()
        now_iso = datetime.now(timezone.utc).isoformat()

        # If there are zero timeline events or order is completely healthy without failure details
        if not timeline and overall_status in ("COMPLETED", "PENDING"):
            return cls._uncertain_response(order_number, correlation_id, "No telemetry events provided for analysis", now_iso)

        # 1. Stage State Reconstruction
        stage_state_map: Dict[str, Dict[str, Any]] = {}
        for s in PIPELINE_SEQUENCE:
            stage_state_map[s] = {"status": "NOT_REACHED", "httpStatusCode": None, "latencyMs": None, "event": None}

        for ev in timeline:
            stg = ev.stage.upper()
            if stg in stage_state_map:
                if ev.eventType in ("STAGE_FAILED", "STAGE_REJECTED", "STAGE_STUCK") or ev.httpStatusCode >= 400:
                    stage_state_map[stg]["status"] = (
                        "FAILED" if ev.eventType == "STAGE_FAILED" or ev.httpStatusCode in (500, 502, 503, 504, 400, 401, 403, 429)
                        else "REJECTED" if ev.eventType == "STAGE_REJECTED" or ev.httpStatusCode == 422
                        else "STUCK"
                    )
                elif ev.eventType == "STAGE_DELAYED":
                    stage_state_map[stg]["status"] = "DELAYED"
                elif ev.eventType == "STAGE_COMPLETED":
                    stage_state_map[stg]["status"] = "SUCCESS"

                stage_state_map[stg]["httpStatusCode"] = ev.httpStatusCode
                stage_state_map[stg]["latencyMs"] = ev.latencyMs
                stage_state_map[stg]["event"] = ev

        # 2. Identify the exact stage where the failure occurred
        failing_stage = None
        failing_event = None
        failing_index = -1

        for idx, stg in enumerate(PIPELINE_SEQUENCE):
            st = stage_state_map[stg]["status"]
            if st in ("FAILED", "REJECTED", "STUCK"):
                failing_stage = stg
                failing_event = stage_state_map[stg]["event"]
                failing_index = idx
                break
            elif st == "DELAYED" and (request.actualProcessingTimeMs > request.expectedCompletionTimeMs or overall_status == "DELAYED"):
                failing_stage = stg
                failing_event = stage_state_map[stg]["event"]
                failing_index = idx
                break

        # If order marked failed/delayed but no individual event failed, check last stage reached
        if not failing_stage:
            for idx in reversed(range(len(PIPELINE_SEQUENCE))):
                stg = PIPELINE_SEQUENCE[idx]
                if stage_state_map[stg]["status"] != "NOT_REACHED":
                    if overall_status in ("FAILED", "REJECTED", "DELAYED", "STUCK"):
                        failing_stage = stg
                        failing_event = stage_state_map[stg]["event"]
                        failing_index = idx
                        break

        # If order was healthy
        if not failing_stage and overall_status == "COMPLETED":
            previous = [
                StageStateSummary(
                    stage=s,
                    status=stage_state_map[s]["status"],
                    httpStatusCode=stage_state_map[s]["httpStatusCode"],
                    latencyMs=stage_state_map[s]["latencyMs"]
                )
                for s in PIPELINE_SEQUENCE
            ]
            return RCAPipelineResponse(
                orderNumber=order_number,
                correlationId=correlation_id,
                failedStage="NONE",
                failureSummary="No failure occurred. All 6 stages completed successfully.",
                rootCauseExplanation="Order processed nominal broadband activation within SLA parameters.",
                possibleReasons=["All microservices responded with HTTP 200 within expected SLA"],
                previousStages=previous,
                affectedDownstreamServices=[],
                recommendedAction="No remediation required. Order is completed.",
                riskTier="LOW",
                confidenceScore=1.0,
                analysisTimestamp=now_iso,
                supportingEvidence={"actualProcessingTimeMs": request.actualProcessingTimeMs}
            )

        # If still cannot identify failing stage or logs are missing
        if not failing_stage or not failing_event:
            return cls._uncertain_response(order_number, correlation_id, "Logs contain insufficient event telemetry to isolate failing component", now_iso)

        # 3. Previous stages (before failing stage)
        previous_stages = []
        for i in range(failing_index):
            s = PIPELINE_SEQUENCE[i]
            previous_stages.append(StageStateSummary(
                stage=s,
                status=stage_state_map[s]["status"],
                httpStatusCode=stage_state_map[s]["httpStatusCode"],
                latencyMs=stage_state_map[s]["latencyMs"]
            ))

        # 4. Affected downstream services (after failing stage)
        affected_downstream = []
        for i in range(failing_index + 1, len(PIPELINE_SEQUENCE)):
            affected_downstream.append(PIPELINE_SEQUENCE[i])

        # 5. Evidence Extraction from Actual Logs
        code = failing_event.httpStatusCode
        err_msg = failing_event.errorMessage or "Unknown stage error"
        latency = failing_event.latencyMs
        metadata = failing_event.metadata or {}

        # 6. Evidence-Based Root Cause Reasoning & Recommendations
        root_cause_explanation = ""
        possible_reasons = []
        recommended_action = ""
        risk_tier = "LOW"
        confidence_score = 0.95

        # Case A: 504 Gateway Timeout or Timeout keyword
        if code == 504 or "timeout" in err_msg.lower():
            root_cause_explanation = (
                f"The {failing_stage} service did not respond within the configured timeout threshold ({latency}ms)."
            )
            possible_reasons = [
                f"Upstream {failing_stage} microservice gateway experienced high network latency or load congestion",
                f"Downstream vendor API timed out after exceeding SLA window of 2000ms",
                f"Worker thread pool starvation in the {failing_stage} cluster"
            ]
            recommended_action = "Retry the request with exponential backoff (idempotent retry up to 3 attempts)."
            risk_tier = "LOW"
            confidence_score = 0.96

        # Case B: 500 Internal Server Error
        elif code == 500:
            root_cause_explanation = (
                f"The {failing_stage} microservice encountered an unhandled internal runtime exception during order execution."
            )
            possible_reasons = [
                f"Null reference / schema mismatch in {failing_stage} payload handling",
                f"Database dead-lock or uncommitted transaction in {failing_stage} store",
                f"Unhandled fault in switch control plane"
            ]
            recommended_action = "Execute single automatic retry; if recurrence occurs, trip Circuit Breaker and escalate to line engineers."
            risk_tier = "HIGH"
            confidence_score = 0.92

        # Case C: 429 Too Many Requests
        elif code == 429:
            root_cause_explanation = (
                f"The {failing_stage} API rejected the order transaction due to upstream rate limiting quota exhaustion."
            )
            possible_reasons = [
                "Burst order ingestion exceeded concurrent API rate limit",
                "Spike in simultaneous broadband activation requests"
            ]
            recommended_action = "Apply client-side rate limiting and retry after a 5000ms cool-down period."
            risk_tier = "LOW"
            confidence_score = 0.95

        # Case D: Rejection - Address
        elif "address" in err_msg.lower() or (code == 422 and failing_stage == "CRM"):
            root_cause_explanation = (
                "The customer installation address is outside the GPON optical fiber service zone boundary."
            )
            possible_reasons = [
                "Premises distance to closest Optical Distribution Point (DP) exceeds 20km optical link budget",
                "Fiber feeder line not yet spliced in customer postal code sector"
            ]
            recommended_action = "Notify Sales CRM to offer customer Fixed Wireless Access (5G FWA) alternative; mark order rejected."
            risk_tier = "MEDIUM"
            confidence_score = 0.98

        # Case E: Rejection - Inventory Depletion
        elif "stock" in err_msg.lower() or "inventory" in err_msg.lower() or (code == 422 and failing_stage == "INVENTORY"):
            root_cause_explanation = (
                "Hardware allocation failed because Optical Network Terminal (ONT) stock is depleted in the local depot."
            )
            possible_reasons = [
                "High subscriber activation volume in local service area",
                "Depot inventory replenishment delay from central logistics hub"
            ]
            recommended_action = "Trigger automated inventory failover to re-allocate ONT router from Regional Backup Depot."
            risk_tier = "LOW"
            confidence_score = 0.94

        # Case F: Rejection - Payment Failure
        elif "payment" in err_msg.lower() or "card" in err_msg.lower() or (code == 422 and failing_stage == "PAYMENT"):
            root_cause_explanation = (
                "The customer auto-debit charge was declined by the payment gateway processor."
            )
            possible_reasons = [
                "Insufficient funds or expired payment authorization token",
                "Card issuing bank triggered automated fraud prevention security block"
            ]
            recommended_action = "Dispatch automated SMS and Email with secure portal link for customer to update billing details."
            risk_tier = "HIGH"
            confidence_score = 0.95

        # Case G: Stuck Processing Stage (Deadlock / HTTP 408)
        elif code == 408 or failing_event.eventType == "STAGE_STUCK" or overall_status == "STUCK":
            root_cause_explanation = (
                f"The order processing stalled indefinitely in {failing_stage} due to a worker thread deadlock."
            )
            possible_reasons = [
                "Optical line port reservation mutex lock was never released by background worker",
                "Missing asynchronous activation completion callback from physical OLT chassis"
            ]
            recommended_action = "Release thread lock, reset worker process, and re-enqueue provisioning job."
            risk_tier = "HIGH"
            confidence_score = 0.90

        # Case H: Delay / SLA Breach
        elif failing_event.eventType == "STAGE_DELAYED" or request.actualProcessingTimeMs > request.expectedCompletionTimeMs:
            root_cause_explanation = (
                f"Processing latency in {failing_stage} ({latency}ms) significantly exceeded the baseline SLA threshold."
            )
            possible_reasons = [
                f"Backlog queue congestion in {failing_stage} worker pool",
                "Simulated high CPU / network contention during optical line provisioning"
            ]
            recommended_action = "Dynamically scale worker thread concurrency for this stage to absorb backlog queue."
            risk_tier = "LOW"
            confidence_score = 0.88

        # Fallback if logs don't match known deterministic patterns
        else:
            return cls._uncertain_response(order_number, correlation_id, f"Unrecognized error pattern in {failing_stage} logs: {err_msg}", now_iso)

        failure_summary = f"{failing_stage} API returned HTTP {code}." if code else f"{failing_stage} encountered processing failure."

        supporting_evidence = {
            "failedStage": failing_stage,
            "httpStatusCode": code,
            "observedLatencyMs": latency,
            "rawErrorMessage": err_msg,
            "eventTimestamp": failing_event.timestamp or now_iso,
            "stageMetadata": metadata,
            "totalEventsAnalyzed": len(timeline)
        }

        return RCAPipelineResponse(
            orderNumber=order_number,
            correlationId=correlation_id,
            failedStage=failing_stage,
            failureSummary=failure_summary,
            rootCauseExplanation=root_cause_explanation,
            possibleReasons=possible_reasons,
            previousStages=previous_stages,
            affectedDownstreamServices=affected_downstream,
            recommendedAction=recommended_action,
            riskTier=risk_tier,
            confidenceScore=confidence_score,
            analysisTimestamp=now_iso,
            supportingEvidence=supporting_evidence
        )

    @classmethod
    def _uncertain_response(cls, order_number: str, correlation_id: str, reason: str, timestamp_iso: str) -> RCAPipelineResponse:
        return RCAPipelineResponse(
            orderNumber=order_number,
            correlationId=correlation_id,
            failedStage="UNKNOWN",
            failureSummary="Insufficient Telemetry Logs",
            rootCauseExplanation="Root cause uncertain - manual investigation required.",
            possibleReasons=[reason, "Telemetry logs lacked necessary HTTP status or error payload details"],
            previousStages=[],
            affectedDownstreamServices=[],
            recommendedAction="Escalate incident to Tier-2 Operations Support for manual log extraction.",
            riskTier="HIGH",
            confidenceScore=0.30,
            analysisTimestamp=timestamp_iso,
            supportingEvidence={"reason": reason, "verdict": "INSUFFICIENT_EVIDENCE"}
        )

    # Legacy support
    @staticmethod
    def predict_root_cause(request: RCAPredictionRequest) -> RCAPredictionResponse:
        stage = request.stage.upper()
        status_code = request.httpStatusCode
        if status_code == 504:
            return RCAPredictionResponse(
                rootCause=f"{stage}_GATEWAY_TIMEOUT",
                confidenceScore=0.94,
                riskTier="LOW",
                recommendedAction="EXPONENTIAL_RETRY",
                contributingFeatures=[f"http_status == {status_code}"]
            )
        return RCAPredictionResponse(
            rootCause=f"{stage}_ERROR",
            confidenceScore=0.85,
            riskTier="HIGH",
            recommendedAction="MANUAL_ESCALATION",
            contributingFeatures=[f"http_status == {status_code}"]
        )
