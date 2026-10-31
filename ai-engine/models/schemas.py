from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class HealthResponse(BaseModel):
    status: str = "UP"
    service: str = "OrderFlow Sentinel AI Engine"
    version: str = "1.0.0"
    modelsLoaded: Dict[str, bool]

# Timeline Event
class TimelineEvent(BaseModel):
    stage: str
    eventType: str
    httpStatusCode: int = 200
    latencyMs: float = 0.0
    errorMessage: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    timestamp: Optional[str] = None

# Failure Detection Schemas
class FailureDetectionRequest(BaseModel):
    orderId: Optional[str] = None
    orderNumber: str
    correlationId: str
    currentStage: str
    overallStatus: str
    expectedCompletionTimeMs: float = 2500.0
    actualProcessingTimeMs: float = 0.0
    timeline: List[TimelineEvent] = []

class FailureDetectionResponse(BaseModel):
    orderNumber: str
    correlationId: str
    isFailure: bool
    failureCategory: str
    failureReason: str
    affectedService: str
    severity: str
    detectionTimestamp: str
    supportingEvidence: Dict[str, Any]

# Root Cause Analysis (RCA) Schemas
class StageStateSummary(BaseModel):
    stage: str
    status: str
    httpStatusCode: Optional[int] = None
    latencyMs: Optional[float] = None

class RCAPipelineRequest(BaseModel):
    orderNumber: str
    correlationId: str
    currentStage: str
    overallStatus: str
    expectedCompletionTimeMs: float = 2500.0
    actualProcessingTimeMs: float = 0.0
    timeline: List[TimelineEvent] = []
    detectedFailure: Optional[Dict[str, Any]] = None

class RCAPipelineResponse(BaseModel):
    orderNumber: str
    correlationId: str
    failedStage: str
    failureSummary: str
    rootCauseExplanation: str
    possibleReasons: List[str]
    previousStages: List[StageStateSummary]
    affectedDownstreamServices: List[str]
    recommendedAction: str
    riskTier: str
    confidenceScore: float
    analysisTimestamp: str
    supportingEvidence: Dict[str, Any]

# Legacy RCA
class RCAPredictionRequest(BaseModel):
    stage: str = Field(..., example="PAYMENT")
    httpStatusCode: int = Field(..., example=504)
    latencyMs: float = Field(..., example=4200.0)
    retryCount: int = Field(default=0, example=1)
    errorMessage: Optional[str] = Field(default="", example="Gateway Timeout on payment vendor API")
    metadata: Optional[Dict[str, Any]] = None

class RCAPredictionResponse(BaseModel):
    rootCause: str
    confidenceScore: float
    riskTier: str
    recommendedAction: str
    contributingFeatures: List[str]

# SLA Breach Models
class SLABreachRequest(BaseModel):
    currentStage: str
    elapsedTimeMs: float
    stageDurations: Dict[str, float] = {}
    activeQueueLength: int = 10

class SLABreachResponse(BaseModel):
    breachProbability: float
    riskLevel: str
    predictedTotalDurationMs: float

# Predictive Digital Twin Schemas
class ScenarioComparison(BaseModel):
    scenarioKey: str
    name: str
    description: str
    estimatedProcessingTimeMs: float
    predictedSlaBreachRisk: float
    expectedTotalDurationMs: float
    recommendedAction: str
    isSafest: bool

class TwinOrderPredictionRequest(BaseModel):
    orderNumber: str
    correlationId: str
    currentStage: str
    elapsedTimeMs: float
    expectedSlaMs: float
    currentApiLatencyMs: float = 200.0
    queueDelayMs: float = 80.0
    retryCount: int = 0
    serviceHealthScore: float = 0.95
    serviceFailureRate: float = 0.03
    previousStages: List[StageStateSummary] = []

class TwinOrderPredictionResponse(BaseModel):
    orderNumber: str
    correlationId: str
    currentStage: str
    elapsedTimeMs: float
    expectedSlaMs: float
    baselineBreachRisk: float
    mlModelBreachProbability: float
    modelAccuracy: float
    isServiceAnomalous: bool
    safestScenario: ScenarioComparison
    scenarioComparisons: List[ScenarioComparison]
    prescriptiveRecommendation: str
    analysisTimestamp: str

# General Digital Twin Sandbox Models
class StageDelayInjection(BaseModel):
    stage: str = "PROVISIONING"
    addedDelay: float = 1000.0

class TwinSimulationRequest(BaseModel):
    orderArrivalMultiplier: float = Field(default=1.3, ge=0.5, le=5.0)
    injectedStageDelayMs: Optional[StageDelayInjection] = None
    simulatedDurationMinutes: int = Field(default=60, ge=10, le=1440)

class PrescriptiveRecommendation(BaseModel):
    action: str
    expectedSlaRiskReduction: float
    safetyRank: int

class BaselineMetrics(BaseModel):
    totalOrdersSimulated: int
    baselineSlaBreachRate: float
    avgCycleTimeSeconds: float

class SimulatedMetrics(BaseModel):
    predictedSlaBreachRate: float
    predictedBottleneckStage: str
    projectedQueueSpike: int

class TwinSimulationResponse(BaseModel):
    baselineMetrics: BaselineMetrics
    simulatedMetrics: SimulatedMetrics
    prescriptiveRecommendations: List[PrescriptiveRecommendation]
