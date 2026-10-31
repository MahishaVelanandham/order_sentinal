"""
Machine Learning SLA Breach Prediction Model
Trained on synthetic labeled telecom broadband order telemetry data.
Uses GradientBoostingClassifier to evaluate non-linear risk of SLA breaches.
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score

STAGE_INDICES = {
    'CRM': 0,
    'ORDER_MANAGEMENT': 1,
    'INVENTORY': 2,
    'PAYMENT': 3,
    'PROVISIONING': 4,
    'NOTIFICATION': 5
}

class SLAPredictionMLModel:
    def __init__(self):
        self.model = None
        self.metrics = {
            "accuracy": 0.0,
            "precision": 0.0,
            "recall": 0.0,
            "samplesTrained": 0
        }
        self._train_model()

    def _generate_synthetic_training_data(self, n_samples: int = 2500):
        """
        Generates realistic labeled synthetic data for broadband SLA breaches
        """
        np.random.seed(42)
        records = []

        for _ in range(n_samples):
            stage_idx = np.random.randint(0, 6)
            stage_name = list(STAGE_INDICES.keys())[stage_idx]

            # Nominal expected SLA based on broadband tier
            expected_sla_ms = np.random.choice([1800.0, 2200.0, 2800.0, 3400.0])

            # Elapsed time so far depends on how far through the pipeline the order is
            expected_fraction = (stage_idx + 1) / 6.0
            elapsed_time_ms = expected_sla_ms * expected_fraction * np.random.uniform(0.6, 1.8)

            # Stage-specific variables
            current_api_latency_ms = np.random.uniform(80.0, 1200.0)
            if np.random.random() < 0.15:  # 15% latency spikes
                current_api_latency_ms += np.random.uniform(1500.0, 3500.0)

            queue_delay_ms = np.random.exponential(scale=200.0)
            retry_count = np.random.choice([0, 0, 0, 1, 1, 2, 3])
            service_failure_rate = np.random.uniform(0.01, 0.25)
            service_health_score = np.random.uniform(0.4, 1.0)

            # Deterministic ground truth calculation for labeling
            remaining_stages = 5 - stage_idx
            projected_remaining_ms = remaining_stages * 300.0 + queue_delay_ms + (retry_count * 500.0)
            if service_health_score < 0.6:
                projected_remaining_ms *= 1.6

            projected_total = elapsed_time_ms + projected_remaining_ms

            # Label: 1 if projected total > expected SLA, else 0
            is_breached = 1 if projected_total > expected_sla_ms else 0

            records.append({
                "stage_idx": stage_idx,
                "elapsed_time_ms": elapsed_time_ms,
                "expected_sla_ms": expected_sla_ms,
                "current_api_latency_ms": current_api_latency_ms,
                "queue_delay_ms": queue_delay_ms,
                "retry_count": retry_count,
                "service_failure_rate": service_failure_rate,
                "service_health_score": service_health_score,
                "is_breached": is_breached
            })

        return pd.DataFrame(records)

    def _train_model(self):
        """
        Trains and validates GradientBoostingClassifier on the synthetic dataset
        """
        df = self._generate_synthetic_training_data(n_samples=2500)
        feature_cols = [
            "stage_idx",
            "elapsed_time_ms",
            "expected_sla_ms",
            "current_api_latency_ms",
            "queue_delay_ms",
            "retry_count",
            "service_failure_rate",
            "service_health_score"
        ]

        X = df[feature_cols].values
        y = df["is_breached"].values

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

        self.model = GradientBoostingClassifier(
            n_estimators=80,
            learning_rate=0.1,
            max_depth=3,
            random_state=42
        )
        self.model.fit(X_train, y_train)

        y_pred = self.model.predict(X_test)
        self.metrics = {
            "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
            "precision": round(float(precision_score(y_test, y_pred)), 4),
            "recall": round(float(recall_score(y_test, y_pred)), 4),
            "samplesTrained": len(X_train)
        }

    def predict_breach_probability(self, features: dict) -> float:
        """
        Inference: Returns predicted probability of SLA breach P(breach) in [0.0, 1.0]
        """
        stage_name = str(features.get("currentStage", "CRM")).upper()
        stage_idx = STAGE_INDICES.get(stage_name, 0)

        vector = np.array([[
            stage_idx,
            float(features.get("elapsedTimeMs", 500.0)),
            float(features.get("expectedSlaMs", 2500.0)),
            float(features.get("currentApiLatencyMs", 200.0)),
            float(features.get("queueDelayMs", 50.0)),
            int(features.get("retryCount", 0)),
            float(features.get("serviceFailureRate", 0.05)),
            float(features.get("serviceHealthScore", 0.95))
        ]])

        probs = self.model.predict_proba(vector)[0]
        breach_prob = float(probs[1])  # Class 1 = Breached
        return round(breach_prob, 4)

# Global singleton
sla_ml_model = SLAPredictionMLModel()
