def evaluate_abac(role: str, resource: str) -> str:
    """
    ABAC Policy rules:
    - Admin -> allow
    - User + public -> allow
    - Otherwise -> deny
    """
    role = role.lower()
    resource = resource.lower()
    
    if role == "admin":
        return "allow"
    elif role == "user" and resource == "public":
        return "allow"
    else:
        return "deny"
