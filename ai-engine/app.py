"""
OrderFlow Sentinel - AI & Predictive Digital Twin Microservice
Built with FastAPI, Scikit-learn, Pandas, and NumPy
"""
import os
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models.schemas import (
    HealthResponse,
    FailureDetectionRequest,
    FailureDetectionResponse,
    RCAPipelineRequest,
    RCAPipelineResponse,
    RCAPredictionRequest,
    RCAPredictionResponse,
    SLABreachRequest,
    SLABreachResponse,
    TwinOrderPredictionRequest,
    TwinOrderPredictionResponse,
    TwinSimulationRequest,
    TwinSimulationResponse
)
from services.detection_service import FailureDetectionEngine
from services.rca_service import RCAService
from services.sla_service import SLAService
from services.twin_service import TwinService
from models.sla_ml_model import sla_ml_model

app = FastAPI(
    title="OrderFlow Sentinel AI Engine",
    description="Machine Learning Failure Detection, Root Cause Analysis, SLA Breach Forecasting, and Predictive Digital Twin Sandbox",
    version="1.0.0"
)

# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", tags=["General"])
def read_root():
    return {
        "service": "OrderFlow Sentinel AI Engine",
        "status": "RUNNING",
        "documentation": "/docs",
        "healthCheck": "/health"
    }

@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check():
    """
    Health check endpoint returning service status and model availability
    """
    return HealthResponse(
        status="UP",
        service="OrderFlow Sentinel AI Engine",
        version="1.0.0",
        modelsLoaded={
            "failureDetectionEngine": True,
            "isolationForestDetector": True,
            "rcaEngine": True,
            "slaBreachPredictor": True,
            "digitalTwinSimulator": True,
            "slaGradientBoostingML": True
        }
    )

@app.post("/detect/failure", response_model=FailureDetectionResponse, tags=["Failure Detection"])
def detect_failure(request: FailureDetectionRequest):
    """
    Evaluates order telemetry and timeline events using rule-based criteria
    and an Isolation Forest outlier model to detect API errors, delays, or rejections.
    """
    try:
        return FailureDetectionEngine.detect_failure(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failure detection error: {str(e)}")

@app.post("/rca/analyze", response_model=RCAPipelineResponse, tags=["Root Cause Analysis"])
def analyze_rca(request: RCAPipelineRequest):
    """
    Performs comprehensive, evidence-grounded Root Cause Analysis (RCA) on the order timeline.
    """
    try:
        return RCAService.analyze_order_failure(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RCA evaluation error: {str(e)}")

@app.post("/twin/predict-order", response_model=TwinOrderPredictionResponse, tags=["Predictive Digital Twin"])
def predict_order_twin(request: TwinOrderPredictionRequest):
    """
    Simulates What-If failure scenarios for an in-flight broadband order.
    Calculates SLA breach probabilities using a GradientBoostingClassifier trained on synthetic data,
    evaluates Scenarios A, B, and C, and selects the safest operational action.
    """
    try:
        return TwinService.predict_and_simulate_order(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Digital Twin prediction error: {str(e)}")

@app.post("/simulate/twin", response_model=TwinSimulationResponse, tags=["Predictive Digital Twin"])
def simulate_twin(request: TwinSimulationRequest):
    """
    Executes Monte Carlo cluster-level What-If simulation sandbox under user-defined stress conditions
    """
    try:
        return TwinService.run_simulation(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Digital Twin simulation error: {str(e)}")

@app.post("/predict/rca", response_model=RCAPredictionResponse, tags=["AI Diagnostics"])
def predict_rca(request: RCAPredictionRequest):
    try:
        return RCAService.predict_root_cause(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RCA evaluation error: {str(e)}")

@app.post("/predict/sla-breach", response_model=SLABreachResponse, tags=["AI Diagnostics"])
def predict_sla_breach(request: SLABreachRequest):
    try:
        return SLAService.predict_breach(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"SLA prediction error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    print(f"Starting OrderFlow Sentinel AI Microservice on {host}:{port}...")
    uvicorn.run("app:app", host=host, port=port, reload=True)
