"""
SLA Breach Prediction Service
Evaluates accumulated latency against historical percentiles
"""
from models.schemas import SLABreachRequest, SLABreachResponse

class SLAService:
    SLA_LIMIT_MS = 15000.0  # 15 seconds simulated maximum order journey

    @classmethod
    def predict_breach(cls, request: SLABreachRequest) -> SLABreachResponse:
        elapsed = request.elapsedTimeMs
        queue_factor = request.activeQueueLength * 120.0
        projected_total = elapsed + queue_factor

        breach_prob = min(max((projected_total / cls.SLA_LIMIT_MS) * 0.75, 0.05), 0.99)
        risk = "HIGH" if breach_prob > 0.7 else "MEDIUM" if breach_prob > 0.3 else "LOW"

        return SLABreachResponse(
            breachProbability=round(breach_prob, 3),
            riskLevel=risk,
            predictedTotalDurationMs=round(projected_total, 1)
        )
