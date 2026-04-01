from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import os

from policy import evaluate_abac
from model import predict_risk
from fusion import make_final_decision
from explain import generate_explanation
from logger import log_request
from retrain import retrain_model

app = FastAPI(title="Hybrid ABAC-ML Access Control")

# Mount UI directory
if os.path.exists("ui"):
    app.mount("/ui", StaticFiles(directory="ui"), name="ui")

class AccessRequest(BaseModel):
    role: str
    resource: str
    is_new_device: int
    request_frequency: float
    time_of_access: int

@app.post("/access")
async def access_control(req: AccessRequest):
    req_dict = req.dict()
    
    # 1. ABAC Policy Evaluation
    policy_decision = evaluate_abac(req.role, req.resource)
    
    # 2. ML Risk Scoring
    features = {
        "is_new_device": req.is_new_device,
        "request_frequency": req.request_frequency,
        "time_of_access": req.time_of_access
    }
    risk_score = predict_risk(features)
    
    # 3. Adaptive Decision Fusion
    final_decision = make_final_decision(policy_decision, risk_score)
    
    # 4. Explainability
    explanation = generate_explanation(req_dict, policy_decision, risk_score, final_decision)
    
    # 5. Logging
    log_request(req_dict, risk_score, final_decision)
    
    return {
        "policy_decision": policy_decision,
        "risk_score": round(risk_score, 4),
        "final_decision": final_decision,
        "explanation": explanation
    }

@app.post("/retrain")
async def trigger_retrain():
    status = retrain_model()
    return {"status": status}

@app.get("/", response_class=HTMLResponse)
async def serve_ui():
    with open("ui/index.html", "r") as f:
        return f.read()
