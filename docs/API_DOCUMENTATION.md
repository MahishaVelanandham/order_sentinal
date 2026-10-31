# API Specification & Reference — OrderFlow Sentinel

> **Base URL:** `http://localhost:5000/api`  
> **Python AI URL:** `http://localhost:8000`  
> **Content-Type:** `application/json`  
> **CORS Origin:** `http://localhost:5173`  

---

## 1. System Health Endpoints

### 1.1 Cluster Health Check
- **Route:** `GET /api/health`
- **Description:** Verifies Gateway uptime, database connection state, and Python AI microservice model readiness.
- **Response `200 OK`:**
```json
{
  "status": "UP",
  "service": "OrderFlow Sentinel Backend",
  "version": "1.0.0",
  "uptimeSeconds": 240,
  "timestamp": "2026-10-30T18:15:00.000Z",
  "dependencies": {
    "database": {
      "name": "MongoDB",
      "status": "CONNECTED",
      "isReady": true
    },
    "aiEngine": {
      "name": "Python FastAPI Microservice",
      "status": "CONNECTED",
      "details": {
        "status": "UP",
        "service": "OrderFlow Sentinel AI Engine",
        "version": "1.0.0",
        "modelsLoaded": {
          "failureDetectionEngine": true,
          "isolationForestDetector": true,
          "rcaEngine": true,
          "slaBreachPredictor": true,
          "digitalTwinSimulator": true,
          "slaGradientBoostingML": true
        }
      }
    }
  }
}
```

---

## 2. Order Simulation & Retrieval Endpoints

### 2.1 Generate Simulated Broadband Order
- **Route:** `POST /api/orders/generate`
- **Description:** Generates synthetic broadband orders and simulates their progression through the 6 stages.
- **Request Body:**
```json
{
  "scenario": "SUCCESS", // "SUCCESS" | "API_ERROR" | "DELAY" | "REJECTION" | "STUCK" | "RANDOM"
  "count": 1
}
```
- **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Generated and simulated 1 synthetic broadband order(s)",
  "count": 1,
  "data": {
    "orderNumber": "ORD-104921",
    "correlationId": "CORR-99214-GPON",
    "customer": {
      "name": "Aarav Sharma",
      "email": "aarav.sharma@example.com",
      "address": "402 Palm Grove, Zone 4B"
    },
    "product": {
      "planName": "Fiber 300 Mbps",
      "speedMbps": 300,
      "priceMonthly": 49.99
    },
    "currentStage": "COMPLETED",
    "overallStatus": "COMPLETED",
    "expectedSlaMs": 3500,
    "actualProcessingTimeMs": 1420
  }
}
```

### 2.2 Get Orders with Filtering
- **Route:** `GET /api/orders`
- **Query Parameters:**
  - `status` (Optional): `COMPLETED`, `FAILED`, `DELAYED`, `REJECTED`, `IN_FLIGHT`
  - `stage` (Optional): `CRM`, `ORDER_MANAGEMENT`, `INVENTORY`, `PAYMENT`, `PROVISIONING`, `NOTIFICATION`
  - `limit` (Default: 50)
  - `skip` (Default: 0)
- **Response `200 OK`:**
```json
{
  "success": true,
  "summary": {
    "TOTAL": 25,
    "COMPLETED": 18,
    "FAILED": 3,
    "DELAYED": 2,
    "REJECTED": 2
  },
  "pagination": {
    "total": 25,
    "limit": 50,
    "skip": 0,
    "returned": 25
  },
  "data": [ /* Order Objects */ ]
}
```

### 2.3 Get Chronological Order Timeline
- **Route:** `GET /api/orders/:id/timeline`
- **Description:** Returns the complete stage transition events with latency, status codes, and metadata.
- **Response `200 OK`:**
```json
{
  "success": true,
  "timeline": [
    {
      "stage": "CRM",
      "eventType": "STAGE_COMPLETED",
      "httpStatusCode": 200,
      "latencyMs": 180,
      "metadata": { "accountVerified": true, "kycStatus": "PASSED" }
    },
    {
      "stage": "ORDER_MANAGEMENT",
      "eventType": "STAGE_COMPLETED",
      "httpStatusCode": 200,
      "latencyMs": 210,
      "metadata": { "routingRule": "GPON_DIRECT" }
    },
    {
      "stage": "PROVISIONING",
      "eventType": "STAGE_FAILED",
      "httpStatusCode": 504,
      "latencyMs": 2500,
      "errorMessage": "504 Gateway Timeout: Upstream OLT fiber activation gateway timed out"
    }
  ]
}
```

---

## 3. Failure Detection & RCA Endpoints

### 3.1 Trigger AI Failure Detection
- **Route:** `POST /api/incidents/detect/:id`
- **Description:** Sends timeline telemetry to Python AI engine to detect errors, SLA delays, and rejections.
- **Response `200 OK`:**
```json
{
  "success": true,
  "incidentDetected": true,
  "incident": {
    "incidentId": "INC-88219-PROV",
    "orderNumber": "ORD-104921",
    "failureCategory": "API_RESPONSE_ERROR",
    "failureReason": "API Timeout: PROVISIONING endpoint exceeded timeout threshold",
    "affectedService": "PROVISIONING",
    "severity": "HIGH",
    "httpStatusCode": 504
  }
}
```

### 3.2 Run Root Cause Analysis (RCA)
- **Route:** `POST /api/incidents/rca/:id`
- **Response `200 OK`:**
```json
{
  "success": true,
  "rca": {
    "orderNumber": "ORD-104921",
    "failedStage": "PROVISIONING",
    "rootCauseExplanation": "The provisioning gateway (olt-provisioner) did not respond within configured timeout (3000ms). Previous 4 stages completed successfully. Gateway returned HTTP 504 Gateway Timeout.",
    "affectedService": "PROVISIONING",
    "blockedDownstreamServices": ["NOTIFICATION"],
    "recommendedAction": "RETRY_WITH_EXPONENTIAL_BACKOFF",
    "riskTier": "LOW_RISK"
  }
}
```

---

## 4. Remediation & Self-Healing Endpoints

### 4.1 Get Recommendations
- **Route:** `GET /api/remediation/recommendations/:orderId`
- **Response `200 OK`:**
```json
{
  "success": true,
  "recommendation": {
    "actionId": "ACT-88219-01",
    "orderNumber": "ORD-104921",
    "actionType": "EXPONENTIAL_RETRY",
    "recommendedAction": "RETRY_WITH_EXPONENTIAL_BACKOFF",
    "riskTier": "LOW_RISK",
    "requiresHumanApproval": false,
    "autoHealEligible": true,
    "idempotencyKey": "IDEM-ORD-104921-PROVISIONING-ATTEMPT-1",
    "decisionReason": "Transient 504 network/server error detected. Safe to retry with exponential backoff (500ms)."
  }
}
```

### 4.2 Approve & Execute Resolution
- **Route:** `POST /api/remediation/approve/:actionId`
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Resolution EXPONENTIAL_RETRY approved and executed successfully.",
  "data": {
    "actionId": "ACT-88219-01",
    "orderNumber": "ORD-104921",
    "correlationId": "CORR-99214-GPON",
    "stage": "PROVISIONING",
    "actionType": "EXPONENTIAL_RETRY",
    "status": "COMPLETED",
    "executionResult": {
      "success": true,
      "responseSummary": "Successfully healed order at PROVISIONING via EXPONENTIAL_RETRY. All subsequent stages completed.",
      "resumedStage": "PROVISIONING",
      "finalOrderStatus": "COMPLETED",
      "executionDurationMs": 240
    }
  }
}
```

### 4.3 Direct Retry Order
- **Route:** `POST /api/remediation/retry/:orderId`
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Order ORD-104921 retried successfully via EXPONENTIAL_RETRY",
  "data": {
    "actionId": "ACT-104921-01",
    "orderNumber": "ORD-104921",
    "actionType": "EXPONENTIAL_RETRY",
    "status": "COMPLETED",
    "executionResult": {
      "success": true,
      "finalOrderStatus": "COMPLETED",
      "executionDurationMs": 260
    }
  }
}
```
- **Error Response `400 Bad Request` (Completed Order Guard):**
```json
{
  "success": false,
  "message": "Completed orders cannot be retried."
}
```
- **Error Response `400 Bad Request` (Max Retries Exceeded):**
```json
{
  "success": false,
  "message": "Max retry limit of 3 exceeded. Order has been escalated to prevent infinite retry loops.",
  "auditRecord": {
    "actionId": "ACT-LIMIT-9921",
    "actionType": "ESCALATE_HUMAN_OPERATOR",
    "status": "ESCALATED",
    "decisionReason": "MAX_RETRY_LIMIT_EXCEEDED: Maximum retry limit of 3 exceeded."
  }
}
```

### 4.4 Escalate Order to Human Operations
- **Route:** `POST /api/remediation/escalate/:orderId`
- **Request Body:** `{ "reason": "Customer address outside optical boundary." }`
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Order escalated to tier-2 human operator queue.",
  "order": {
    "orderNumber": "ORD-104921",
    "overallStatus": "REJECTED",
    "resolutionStatus": "ESCALATED"
  }
}
```

### 4.5 Remediation Audit Trail History
- **Route:** `GET /api/remediation/history`
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": [
    {
      "actionId": "ACT-88219-01",
      "orderNumber": "ORD-104921",
      "actionType": "EXPONENTIAL_RETRY",
      "riskTier": "LOW_RISK",
      "status": "SUCCESS",
      "initiatedBy": "AUTONOMOUS_SENTINEL_AI",
      "idempotencyKey": "IDEM-ORD-104921-PROVISIONING-ATTEMPT-1",
      "timestamp": "2026-10-30T18:12:00.000Z"
    }
  ]
}
```

---

## 5. Predictive Digital Twin Endpoints

### 5.1 Run What-If Order Simulation
- **Route:** `POST /api/twin/predict/:orderId`
- **Request Body (Optional Overrides):**
```json
{
  "queueDelayMs": 250,
  "serviceHealthScore": 0.75,
  "serviceFailureRate": 0.10
}
```
- **Response `200 OK` (Standardized 7-Attribute Prediction Contract):**
```json
{
  "success": true,
  "data": {
    "predictionId": "PRED-104921-9B",
    "orderNumber": "ORD-104921",
    "riskScore": 78,
    "currentStage": "PROVISIONING",
    "elapsedTimeMs": 1450,
    "expectedSlaMs": 3500,
    "expectedCompletionTimeMs": 1870,
    "baselineBreachRisk": 0.42,
    "predictedSlaBreachProbability": 0.44,
    "modelAccuracy": "Empirically evaluated on holdout test set",
    "isServiceAnomalous": false,
    "safestScenario": {
      "scenarioKey": "SCENARIO_C",
      "name": "Route via Standby Backup Gateway",
      "estimatedProcessingTimeMs": 420,
      "predictedSlaBreachRisk": 0.08,
      "expectedTotalDurationMs": 1870,
      "recommendedAction": "ROUTE_BACKUP_GATEWAY",
      "isSafest": true
    },
    "simulationScenarios": [
      {
        "scenarioKey": "SCENARIO_A",
        "name": "Scenario A: Continue Current Gateway",
        "estimatedProcessingTimeMs": 2400,
        "predictedSlaBreachRisk": 0.88,
        "expectedTotalDurationMs": 3850,
        "recommendedAction": "MAINTAIN_ROUTE",
        "isSafest": false
      },
      {
        "scenarioKey": "SCENARIO_B",
        "name": "Scenario B: Retry with 500ms Backoff",
        "estimatedProcessingTimeMs": 1400,
        "predictedSlaBreachRisk": 0.45,
        "expectedTotalDurationMs": 2850,
        "recommendedAction": "BACKOFF_RETRY",
        "isSafest": false
      },
      {
        "scenarioKey": "SCENARIO_C",
        "name": "Scenario C: Route to Standby Gateway",
        "estimatedProcessingTimeMs": 420,
        "predictedSlaBreachRisk": 0.08,
        "expectedTotalDurationMs": 1870,
        "recommendedAction": "ROUTE_BACKUP_GATEWAY",
        "isSafest": true
      }
    ],
    "recommendedAction": "ROUTE_BACKUP_GATEWAY",
    "prescriptiveRecommendation": "Route in-flight order through Standby Provisioning Gateway (olt-backup-02) to maintain SLA under 3500ms.",
    "supportingEvidence": {
      "currentApiLatencyMs": 2500,
      "queueDelayMs": 250,
      "serviceHealthScore": 0.75,
      "isServiceAnomalous": false,
      "slaThresholdMs": 3500,
      "precedingStages": ["CRM", "ORDER_MANAGEMENT", "INVENTORY", "PAYMENT"]
    }
  }
}
```

> **Decoupled Simulation Guarantee:** `POST /api/twin/predict/:orderId` executes an independent virtual simulation in memory. It operates as a read-only advisor: it **never modifies the real order state in MongoDB** and **never triggers live recovery actions**. Live execution is strictly delegated to the Resolution Centre.

---

## 6. Real-Time WebSocket Event Reference

The frontend connects via Socket.io to `http://localhost:5000`.

| Event Topic | Direction | Payload Summary |
|---|---|---|
| `connect` | Server $\to$ Client | Acknowledges live bi-directional connection |
| `order:created` | Server $\to$ Client | `{ orderId, orderNumber, stage, status, scenario }` |
| `order:progressed` | Server $\to$ Client | `{ orderNumber, stage, nextStage, latencyMs }` |
| `order:failed` | Server $\to$ Client | `{ orderNumber, stage, statusCode, error }` |
| `order:delayed` | Server $\to$ Client | `{ orderNumber, stage, latencyMs }` |
| `order:healed` | Server $\to$ Client | `{ orderNumber, healedStatus, actionId }` |
| `incident:detected` | Server $\to$ Client | Complete incident document |
| `twin:predicted` | Server $\to$ Client | `{ orderNumber, predictionId, safestScenario }` |
