from logger import get_recent_anomaly_rate

def make_final_decision(policy_decision: str, risk_score: float) -> str:
    """
    Combines ABAC decision with ML risk score using adaptive thresholds.
    """
    # If ABAC denies, always deny (strict policy)
    if policy_decision == "deny":
        return "deny"
        
    # Adaptive thresholds based on recent anomalies
    anomaly_rate = get_recent_anomaly_rate()
    
    # Default thresholds
    t_allow = 0.4
    t_deny = 0.7
    
    # Adapt thresholds: if anomaly rate is high, become stricter (lower thresholds)
    if anomaly_rate > 0.2:
        t_allow = 0.3
        t_deny = 0.6
    elif anomaly_rate < 0.05:
        # Relax thresholds if very few anomalies
        t_allow = 0.5
        t_deny = 0.8
        
    if risk_score < t_allow:
        return "allow"
    elif risk_score < t_deny:
        return "step-up"
    else:
        return "deny"
