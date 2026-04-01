import numpy as np
from sklearn.ensemble import IsolationForest
import pickle
from logger import get_all_logs
from model import MODEL_FILE

def retrain_model():
    logs = get_all_logs()
    if len(logs) < 50:
        return "Not enough data to retrain (need at least 50 logs)."
        
    # Extract features from logs
    # We only train on requests that were 'allow' to learn normal behavior
    normal_data = []
    for log in logs:
        if log["final_decision"] == "allow":
            normal_data.append([
                int(log["is_new_device"]),
                float(log["request_frequency"]),
                int(log["time_of_access"])
            ])
            
    if len(normal_data) < 20:
        return "Not enough 'allow' logs to retrain."
        
    X = np.array(normal_data)
    
    clf = IsolationForest(n_estimators=100, contamination=0.1, random_state=42)
    clf.fit(X)
    
    with open(MODEL_FILE, "wb") as f:
        pickle.dump(clf, f)
        
    return f"Model retrained successfully on {len(normal_data)} samples."
