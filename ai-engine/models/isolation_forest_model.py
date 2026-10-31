"""
Isolation Forest Anomaly Detection Model for Telecom Service Latencies
Detects unusual processing times, slow services, and latency outliers
"""
import numpy as np
from sklearn.ensemble import IsolationForest

class ServiceLatencyIsolationForest:
    STAGE_EXPECTED_SLA = {
        'CRM': 300.0,
        'ORDER_MANAGEMENT': 350.0,
        'INVENTORY': 400.0,
        'PAYMENT': 500.0,
        'PROVISIONING': 800.0,
        'NOTIFICATION': 250.0
    }

    def __init__(self):
        self.model = None
        self._train_baseline_model()

    def _train_baseline_model(self):
        """
        Trains Isolation Forest on synthetic distribution of normal operations
        """
        np.random.seed(42)
        n_samples_per_stage = 150
        training_data = []

        for stage, sla in self.STAGE_EXPECTED_SLA.items():
            mean_latency = sla * 0.45
            std_latency = sla * 0.12
            # Normal distribution of healthy operations
            latencies = np.random.normal(loc=mean_latency, scale=std_latency, size=n_samples_per_stage)
            latencies = np.clip(latencies, 30.0, sla * 0.95)

            for lat in latencies:
                ratio = lat / sla
                http_err = 0.0
                training_data.append([lat, ratio, http_err])

        # Add small contamination of anomalies for robust boundary
        n_anomalies = 30
        for _ in range(n_anomalies):
            extreme_lat = np.random.uniform(1500.0, 5000.0)
            ratio = extreme_lat / 500.0
            http_err = np.random.choice([0.0, 1.0])
            training_data.append([extreme_lat, ratio, http_err])

        X = np.array(training_data)
        self.model = IsolationForest(
            n_estimators=100,
            contamination=0.05,
            random_state=42
        )
        self.model.fit(X)

    def evaluate_latency_anomaly(self, stage: str, latency_ms: float, http_status_code: int = 200):
        """
        Inference: Returns anomaly status and score
        """
        sla = self.STAGE_EXPECTED_SLA.get(stage.upper(), 500.0)
        ratio = latency_ms / sla
        http_err = 1.0 if http_status_code >= 400 else 0.0

        sample = np.array([[latency_ms, ratio, http_err]])
        prediction = self.model.predict(sample)[0]  # -1 for anomaly, 1 for normal
        decision_score = self.model.decision_function(sample)[0]

        is_anomaly = bool(prediction == -1 or latency_ms > (sla * 1.5))

        return {
            "isAnomaly": is_anomaly,
            "anomalyScore": round(float(decision_score), 4),
            "expectedStageSlaMs": sla,
            "observedLatencyMs": latency_ms,
            "ratioToExpectedSla": round(float(ratio), 2),
            "severity": "CRITICAL" if decision_score < -0.20 else ("HIGH" if is_anomaly else "NORMAL")
        }

# Singleton instance
isolation_forest_detector = ServiceLatencyIsolationForest()
