def generate_explanation(req_data: dict, policy_decision: str, risk_score: float, final_decision: str) -> str:
    reasons = []
    
    # 1. Policy reasons
    if policy_decision == "deny":
        reasons.append(f"ABAC policy denied access for role '{req_data['role']}' to resource '{req_data['resource']}'.")
    else:
        reasons.append(f"ABAC policy allowed access.")
        
    # 2. ML Risk reasons
    if risk_score >= 0.4:
        risk_factors = []
        if req_data["is_new_device"] == 1:
            risk_factors.append("new device usage")
        if req_data["request_frequency"] > 20:
            risk_factors.append("high request frequency")
        if req_data["time_of_access"] < 6 or req_data["time_of_access"] > 22:
            risk_factors.append("unusual time of access")
            
        if risk_factors:
            reasons.append(f"Elevated risk score ({risk_score:.2f}) due to " + " and ".join(risk_factors) + ".")
        else:
            reasons.append(f"Elevated risk score ({risk_score:.2f}) detected by anomaly model.")
            
    # 3. Final Decision
    explanation = " ".join(reasons)
    explanation += f" Final decision: {final_decision.upper()}."
    
    return explanation
