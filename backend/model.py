import numpy as np
from sklearn.ensemble import IsolationForest
import os
import pickle

MODEL_FILE = "isolation_forest.pkl"

def train_initial_model():
    # Generate synthetic normal data
    # Normal behavior: not a new device (0), low frequency (1-10), normal hours (8-18)
    np.random.seed(42)
    normal_data = []
    for _ in range(500):
        is_new = np.random.choice([0, 1], p=[0.95, 0.05])
        freq = np.random.uniform(1, 15)
        time = np.random.randint(6, 22)
        normal_data.append([is_new, freq, time])
        
    clf = IsolationForest(n_estimators=100, contamination=0.1, random_state=42)
    clf.fit(normal_data)
    
    with open(MODEL_FILE, "wb") as f:
        pickle.dump(clf, f)
    return clf

def get_model():
    if not os.path.exists(MODEL_FILE):
        return train_initial_model()
    with open(MODEL_FILE, "rb") as f:
        return pickle.load(f)

def predict_risk(features: dict) -> float:
    clf = get_model()
    X = np.array([[features["is_new_device"], features["request_frequency"], features["time_of_access"]]])
    
    # IsolationForest decision_function returns positive for normal, negative for anomaly
    # We want a risk score from 0 to 1, where 1 is high risk (anomaly)
    score = clf.decision_function(X)[0]
    
    # Normalize score to 0-1 (approximate based on typical IF bounds)
    # IF scores typically range from -0.5 to 0.5
    # Lower score -> higher risk
    risk = 0.5 - score
    risk = max(0.0, min(1.0, risk)) # clip to 0-1
    return float(risk)
