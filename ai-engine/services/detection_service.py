"""
Failure Detection Service
Combines rule-based deterministic identification with
an Isolation Forest model for anomalous latency detection.
"""
from datetime import datetime, timezone
from typing import Dict, Any, List
from models.schemas import FailureDetectionRequest, FailureDetectionResponse, TimelineEvent
from models.isolation_forest_model import isolation_forest_detector

KNOWN_API_ERROR_CODES = {
    400: ("HTTP_400_BAD_REQUEST", "Malformed order payload or invalid stage parameters", "MEDIUM"),
    401: ("HTTP_401_UNAUTHORIZED", "Expired credentials or missing authorization bearer token", "HIGH"),
    403: ("HTTP_403_FORBIDDEN", "Access forbidden: IP restriction or insufficient service role permissions", "HIGH"),
    429: ("HTTP_429_RATE_LIMITED", "Upstream API rate limit exceeded: Too many concurrent requests", "HIGH"),
    500: ("HTTP_500_INTERNAL_SERVER_ERROR", "Unhandled runtime exception in telecom backend switch", "CRITICAL"),
    502: ("HTTP_502_BAD_GATEWAY", "Bad Gateway: Upstream server returned invalid response", "HIGH"),
    503: ("HTTP_503_SERVICE_UNAVAILABLE", "Service Unavailable: Service overloaded or undergoing failover", "HIGH"),
    504: ("HTTP_504_GATEWAY_TIMEOUT", "Gateway Timeout: Upstream vendor did not respond within SLA window", "HIGH"),
    408: ("HTTP_408_REQUEST_TIMEOUT", "API Request Timeout: Stage execution timed out", "HIGH")
}

class FailureDetectionEngine:
    @classmethod
    def detect_failure(cls, request: FailureDetectionRequest) -> FailureDetectionResponse:
        timeline = request.timeline or []
        order_number = request.orderNumber
        correlation_id = request.correlationId
        current_stage = request.currentStage
        overall_status = request.overallStatus.upper()
        now_iso = datetime.now(timezone.utc).isoformat()

        # ---------------------------------------------------------
        # PASS 1: Check for API Response Errors (Rule-Based)
        # ---------------------------------------------------------
        for ev in timeline:
            code = ev.httpStatusCode
            err_msg = (ev.errorMessage or "").lower()
            metadata = ev.metadata or {}

            # Malformed JSON / Schema mismatch
            if metadata.get("malformed_response") or "malformed" in err_msg or "json parse" in err_msg or "schema" in err_msg:
                return FailureDetectionResponse(
                    orderNumber=order_number,
                    correlationId=correlation_id,
                    isFailure=True,
                    failureCategory="API_RESPONSE_ERROR",
                    failureReason="Malformed API Response: JSON payload failed schema validation",
                    affectedService=ev.stage,
                    severity="HIGH",
                    detectionTimestamp=now_iso,
                    supportingEvidence={
                        "ruleMatched": "MALFORMED_API_PAYLOAD",
                        "httpStatusCode": code,
                        "rawErrorMessage": ev.errorMessage,
                        "stage": ev.stage,
                        "metadata": metadata
                    }
                )

            # API Timeout keyword check
            if "timeout" in err_msg or code in (504, 408):
                desc = KNOWN_API_ERROR_CODES.get(code, ("API_TIMEOUT", "API call timed out", "HIGH"))
                return FailureDetectionResponse(
                    orderNumber=order_number,
                    correlationId=correlation_id,
                    isFailure=True,
                    failureCategory="API_RESPONSE_ERROR",
                    failureReason=f"API Timeout: {ev.stage} endpoint exceeded timeout threshold",
                    affectedService=ev.stage,
                    severity=desc[2],
                    detectionTimestamp=now_iso,
                    supportingEvidence={
                        "ruleMatched": desc[0],
                        "httpStatusCode": code,
                        "rawErrorMessage": ev.errorMessage,
                        "observedLatencyMs": ev.latencyMs,
                        "stage": ev.stage
                    }
                )

            # Known HTTP Error status codes (400, 401, 403, 429, 500, 502, 503, 504)
            if code in KNOWN_API_ERROR_CODES and code != 200:
                rule_name, reason_desc, sev = KNOWN_API_ERROR_CODES[code]
                return FailureDetectionResponse(
                    orderNumber=order_number,
                    correlationId=correlation_id,
                    isFailure=True,
                    failureCategory="API_RESPONSE_ERROR",
                    failureReason=f"{rule_name}: {reason_desc}",
                    affectedService=ev.stage,
                    severity=sev,
                    detectionTimestamp=now_iso,
                    supportingEvidence={
                        "ruleMatched": rule_name,
                        "httpStatusCode": code,
                        "rawErrorMessage": ev.errorMessage,
                        "stage": ev.stage
                    }
                )

            # Stage Failed event marker with 5xx
            if ev.eventType == "STAGE_FAILED" and code >= 500:
                return FailureDetectionResponse(
                    orderNumber=order_number,
                    correlationId=correlation_id,
                    isFailure=True,
                    failureCategory="API_RESPONSE_ERROR",
                    failureReason=f"Internal Service Error: {ev.errorMessage or 'Stage failure encountered'}",
                    affectedService=ev.stage,
                    severity="CRITICAL",
                    detectionTimestamp=now_iso,
                    supportingEvidence={
                        "ruleMatched": "GENERIC_HTTP_5XX",
                        "httpStatusCode": code,
                        "rawErrorMessage": ev.errorMessage,
                        "stage": ev.stage
                    }
                )

        # ---------------------------------------------------------
        # PASS 2: Check for Order Rejections (Rule-Based)
        # ---------------------------------------------------------
        for ev in timeline:
            err_msg = (ev.errorMessage or "").lower()
            metadata = ev.metadata or {}
            is_rejected_event = ev.eventType == "STAGE_REJECTED" or ev.httpStatusCode == 422

            if is_rejected_event or overall_status == "REJECTED":
                # 1. Invalid Address
                if "address" in err_msg or "boundary" in err_msg or "zone" in err_msg or metadata.get("rejectionReason") == "UNSERVICEABLE_ADDRESS":
                    return FailureDetectionResponse(
                        orderNumber=order_number,
                        correlationId=correlation_id,
                        isFailure=True,
                        failureCategory="ORDER_REJECTION",
                        failureReason="Invalid Address: Customer installation location is outside GPON optical fiber service zone",
                        affectedService=ev.stage if is_rejected_event else "CRM",
                        severity="MEDIUM",
                        detectionTimestamp=now_iso,
                        supportingEvidence={
                            "ruleMatched": "REJECTION_INVALID_ADDRESS",
                            "httpStatusCode": ev.httpStatusCode,
                            "rawErrorMessage": ev.errorMessage,
                            "metadata": metadata
                        }
                    )
                # 2. Duplicate Order
                elif "duplicate" in err_msg or metadata.get("duplicateOrder"):
                    return FailureDetectionResponse(
                        orderNumber=order_number,
                        correlationId=correlation_id,
                        isFailure=True,
                        failureCategory="ORDER_REJECTION",
                        failureReason="Duplicate Order: An active broadband provisioning request already exists for this customer",
                        affectedService=ev.stage if is_rejected_event else "ORDER_MANAGEMENT",
                        severity="LOW",
                        detectionTimestamp=now_iso,
                        supportingEvidence={
                            "ruleMatched": "REJECTION_DUPLICATE_ORDER",
                            "httpStatusCode": ev.httpStatusCode,
                            "rawErrorMessage": ev.errorMessage
                        }
                    )
                # 3. Inventory Unavailable
                elif "stock" in err_msg or "inventory" in err_msg or "depleted" in err_msg or ev.stage == "INVENTORY":
                    return FailureDetectionResponse(
                        orderNumber=order_number,
                        correlationId=correlation_id,
                        isFailure=True,
                        failureCategory="ORDER_REJECTION",
                        failureReason="Inventory Unavailable: Optical Network Terminal (ONT) hardware stock depleted in regional warehouse",
                        affectedService="INVENTORY",
                        severity="HIGH",
                        detectionTimestamp=now_iso,
                        supportingEvidence={
                            "ruleMatched": "REJECTION_INVENTORY_DEPLETED",
                            "httpStatusCode": ev.httpStatusCode,
                            "rawErrorMessage": ev.errorMessage
                        }
                    )
                # 4. Payment Rejection
                elif "payment" in err_msg or "card" in err_msg or "decline" in err_msg or "credit" in err_msg or ev.stage == "PAYMENT":
                    return FailureDetectionResponse(
                        orderNumber=order_number,
                        correlationId=correlation_id,
                        isFailure=True,
                        failureCategory="ORDER_REJECTION",
                        failureReason="Payment Rejection: Customer auto-debit transaction was declined by issuing bank",
                        affectedService="PAYMENT",
                        severity="HIGH",
                        detectionTimestamp=now_iso,
                        supportingEvidence={
                            "ruleMatched": "REJECTION_PAYMENT_DECLINED",
                            "httpStatusCode": ev.httpStatusCode,
                            "rawErrorMessage": ev.errorMessage
                        }
                    )
                # 5. Generic Business Rule Violation
                else:
                    return FailureDetectionResponse(
                        orderNumber=order_number,
                        correlationId=correlation_id,
                        isFailure=True,
                        failureCategory="ORDER_REJECTION",
                        failureReason=f"Business Rule Violation: {ev.errorMessage or 'Order rejected during validation'}",
                        affectedService=ev.stage,
                        severity="MEDIUM",
                        detectionTimestamp=now_iso,
                        supportingEvidence={
                            "ruleMatched": "REJECTION_BUSINESS_RULE",
                            "httpStatusCode": ev.httpStatusCode,
                            "rawErrorMessage": ev.errorMessage
                        }
                    )

        # ---------------------------------------------------------
        # PASS 3: Check for Order Delays (SLA, Watchdog & Isolation Forest)
        # ---------------------------------------------------------
        # 1. Stuck Stage Check
        for ev in timeline:
            if ev.eventType == "STAGE_STUCK" or overall_status == "STUCK":
                return FailureDetectionResponse(
                    orderNumber=order_number,
                    correlationId=correlation_id,
                    isFailure=True,
                    failureCategory="ORDER_DELAY",
                    failureReason="Stuck Processing Stage: Worker thread deadlocked while reserving OLT optical line port",
                    affectedService=ev.stage,
                    severity="CRITICAL",
                    detectionTimestamp=now_iso,
                    supportingEvidence={
                        "ruleMatched": "STUCK_PROCESSING_STAGE",
                        "stage": ev.stage,
                        "rawErrorMessage": ev.errorMessage,
                        "httpStatusCode": ev.httpStatusCode
                    }
                )

        # 2. Missing Callbacks Check
        for ev in timeline:
            metadata = ev.metadata or {}
            err_msg = (ev.errorMessage or "").lower()
            if metadata.get("missingCallback") or "callback" in err_msg:
                return FailureDetectionResponse(
                    orderNumber=order_number,
                    correlationId=correlation_id,
                    isFailure=True,
                    failureCategory="ORDER_DELAY",
                    failureReason="Missing Callback: Asynchronous line activation callback never received from network element",
                    affectedService=ev.stage,
                    severity="HIGH",
                    detectionTimestamp=now_iso,
                    supportingEvidence={
                        "ruleMatched": "MISSING_ASYNC_CALLBACK",
                        "stage": ev.stage,
                        "rawErrorMessage": ev.errorMessage
                    }
                )

        # 3. Isolation Forest Check on Stage Latencies
        for ev in timeline:
            if ev.latencyMs > 0:
                anomaly_eval = isolation_forest_detector.evaluate_latency_anomaly(
                    stage=ev.stage,
                    latency_ms=ev.latencyMs,
                    http_status_code=ev.httpStatusCode
                )
                if anomaly_eval["isAnomaly"]:
                    return FailureDetectionResponse(
                        orderNumber=order_number,
                        correlationId=correlation_id,
                        isFailure=True,
                        failureCategory="ORDER_DELAY",
                        failureReason=f"Unusually Slow Service: Isolation Forest flagged abnormal processing delay in {ev.stage}",
                        affectedService=ev.stage,
                        severity=anomaly_eval["severity"],
                        detectionTimestamp=now_iso,
                        supportingEvidence={
                            "ruleMatched": "ISOLATION_FOREST_LATENCY_ANOMALY",
                            "isolationForestScore": anomaly_eval["anomalyScore"],
                            "observedLatencyMs": ev.latencyMs,
                            "expectedStageSlaMs": anomaly_eval["expectedStageSlaMs"],
                            "ratioToExpectedSla": anomaly_eval["ratioToExpectedSla"],
                            "stage": ev.stage
                        }
                    )

        # 4. Total Order SLA Breach Check
        expected = request.expectedCompletionTimeMs or 2500.0
        actual = request.actualProcessingTimeMs or 0.0

        if actual > expected or overall_status == "DELAYED":
            breach_delta = actual - expected
            return FailureDetectionResponse(
                orderNumber=order_number,
                correlationId=correlation_id,
                isFailure=True,
                failureCategory="ORDER_DELAY",
                failureReason=f"Order Exceeding SLA: Processing time ({actual}ms) exceeded expected threshold ({expected}ms)",
                affectedService=current_stage,
                severity="CRITICAL" if actual > (expected * 1.5) else "HIGH",
                detectionTimestamp=now_iso,
                supportingEvidence={
                    "ruleMatched": "ORDER_TOTAL_SLA_BREACH",
                    "expectedCompletionTimeMs": expected,
                    "actualProcessingTimeMs": actual,
                    "breachDeltaMs": breach_delta
                }
            )

        # ---------------------------------------------------------
        # PASS 4: Clean / Healthy Order
        # ---------------------------------------------------------
        return FailureDetectionResponse(
            orderNumber=order_number,
            correlationId=correlation_id,
            isFailure=False,
            failureCategory="NONE",
            failureReason="Order is healthy and operating within all nominal SLA parameters",
            affectedService="NONE",
            severity="NONE",
            detectionTimestamp=now_iso,
            supportingEvidence={
                "actualProcessingTimeMs": actual,
                "expectedCompletionTimeMs": expected,
                "totalEventsAnalyzed": len(timeline),
                "healthy": True
            }
        )
