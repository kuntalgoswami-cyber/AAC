import csv
import os
from datetime import datetime

LOG_FILE = "access_logs.csv"

def init_log():
    if not os.path.exists(LOG_FILE):
        with open(LOG_FILE, mode='w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["timestamp", "role", "resource", "is_new_device", "request_frequency", "time_of_access", "risk_score", "final_decision"])

def log_request(req_data: dict, risk_score: float, final_decision: str):
    init_log()
    with open(LOG_FILE, mode='a', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            datetime.now().isoformat(),
            req_data["role"],
            req_data["resource"],
            req_data["is_new_device"],
            req_data["request_frequency"],
            req_data["time_of_access"],
            risk_score,
            final_decision
        ])

def get_recent_anomaly_rate() -> float:
    """
    Calculates the ratio of 'deny' or 'step-up' decisions in the last N requests.
    """
    if not os.path.exists(LOG_FILE):
        return 0.0
        
    recent_decisions = []
    with open(LOG_FILE, mode='r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            recent_decisions.append(row["final_decision"])
            
    # Look at last 50 requests
    recent = recent_decisions[-50:]
    if not recent:
        return 0.0
        
    anomalies = sum(1 for d in recent if d in ["deny", "step-up"])
    return anomalies / len(recent)

def get_all_logs():
    logs = []
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, mode='r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                logs.append(row)
    return logs
