import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import crypto from "crypto";
import cors from "cors";
import jwt from "jsonwebtoken";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import Redis from "ioredis";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

app.use(express.json());
app.use(cors());
app.use(helmet({ contentSecurityPolicy: false }));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Too many requests from this IP" }
});
app.use("/api/", apiLimiter);

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "enterprise-soc-secret-key-2026";

// --- 1. DISTRIBUTED STATE SIMULATION (Mock Redis with TTL & Atomic Ops) ---
const INITIAL_MATRIX: Record<string, Record<string, number>> = {
    "START": { "READ_TICKET": 0.9, "GET_USER_INFO": 0.1 },
    "READ_TICKET": { "GET_USER_INFO": 0.8, "SUMMARIZE_TEXT": 0.15, "EXPORT_DB": 0.05 },
    "GET_USER_INFO": { "SUMMARIZE_TEXT": 0.7, "DRAFT_REPLY": 0.2, "READ_TICKET": 0.1 },
    "SUMMARIZE_TEXT": { "DRAFT_REPLY": 0.9, "SEND_EMAIL": 0.1 },
    "DRAFT_REPLY": { "SEND_EMAIL": 0.95, "SUMMARIZE_TEXT": 0.05 },
    "SEND_EMAIL": { "END": 0.9, "READ_TICKET": 0.1 },
    "EXPORT_DB": { "SEND_EXTERNAL_WEBHOOK": 0.9, "END": 0.1 },
    "SEND_EXTERNAL_WEBHOOK": { "END": 1.0 }
};

interface IDatabase {
    dynamicMatrix: Record<string, Record<string, number>>;
    getSession(agentId: string): Promise<{api: string, timestamp: number}[]>;
    appendToSession(agentId: string, api: string): Promise<void>;
    resetSession(agentId: string): Promise<void>;
    addLog(logData: any): Promise<any>;
    getLogs(limit?: number): Promise<any[]>;
    addHitl(logId: string, data: any): Promise<void>;
    getAllHitl(): Promise<any[]>;
    atomicResolveHitl(logId: string): Promise<any | null>;
    blockToken(token: string): Promise<void>;
    isTokenBlocked(token: string): Promise<boolean>;
    updateDynamicMatrix?(matrix: any): Promise<void>;
    blockAgent(agentId: string): Promise<void>;
    isAgentBlocked(agentId: string): Promise<boolean>;
}

class MockRedis implements IDatabase {
    private sessions: Map<string, { data: {api: string, timestamp: number}[], expiresAt: number }> = new Map();
    private hitlQueue: Map<string, any> = new Map();
    private logs: any[] = [];
    private lastHash: string = "0".repeat(64);
    private tokenBlocklist: Set<string> = new Set();
    
    public dynamicMatrix: Record<string, Record<string, number>> = JSON.parse(JSON.stringify(INITIAL_MATRIX));

    constructor() {
        setInterval(() => this.cleanupExpiredSessions(), 60000);
    }

    private cleanupExpiredSessions() {
        const now = Date.now();
        for (const [key, value] of this.sessions.entries()) {
            if (value.expiresAt < now) {
                this.sessions.delete(key);
            }
        }
    }

    async getSession(agentId: string) { 
        const session = this.sessions.get(agentId);
        return session ? session.data : []; 
    }

    async appendToSession(agentId: string, api: string) {
        const session = this.sessions.get(agentId) || { data: [], expiresAt: 0 };
        session.data.push({ api, timestamp: Date.now() });
        session.expiresAt = Date.now() + (1000 * 60 * 60);
        this.sessions.set(agentId, session);
    }

    async resetSession(agentId: string) { 
        this.sessions.delete(agentId); 
    }

    async addLog(logData: any) {
        const logEntry = { ...logData, prevHash: this.lastHash };
        const hash = crypto.createHash('sha256').update(JSON.stringify(logEntry)).digest('hex');
        logEntry.hash = hash;
        this.logs.unshift(logEntry);
        this.lastHash = hash;
        
        if (this.logs.length > 1000) this.logs.pop();
        return logEntry;
    }
    async getLogs(limit = 50) { return this.logs.slice(0, limit); }

    async addHitl(logId: string, data: any) { this.hitlQueue.set(logId, data); }
    async getAllHitl() { return Array.from(this.hitlQueue.values()); }

    async atomicResolveHitl(logId: string): Promise<any | null> {
        if (!this.hitlQueue.has(logId)) return null;
        const data = this.hitlQueue.get(logId);
        this.hitlQueue.delete(logId);
        return data;
    }

    async blockToken(token: string) { this.tokenBlocklist.add(token); }
    async isTokenBlocked(token: string) { return this.tokenBlocklist.has(token); }
    
    // Agent Kill Switch
    private blockedAgents: Set<string> = new Set();
    async blockAgent(agentId: string) { this.blockedAgents.add(agentId); }
    async isAgentBlocked(agentId: string) { return this.blockedAgents.has(agentId); }
}

class RealRedis implements IDatabase {
    private redis: Redis;
    public dynamicMatrix: Record<string, Record<string, number>> = JSON.parse(JSON.stringify(INITIAL_MATRIX));

    constructor(redisUrl: string) {
        this.redis = new Redis(redisUrl);
        this.redis.get("dynamicMatrix").then(val => {
            if (val) this.dynamicMatrix = JSON.parse(val);
        });
    }

    async getSession(agentId: string) { 
        const val = await this.redis.get(`session:${agentId}`);
        return val ? JSON.parse(val) : [];
    }

    async appendToSession(agentId: string, api: string) {
        const session = await this.getSession(agentId);
        session.push({ api, timestamp: Date.now() });
        await this.redis.set(`session:${agentId}`, JSON.stringify(session), "EX", 3600);
    }

    async resetSession(agentId: string) { 
        await this.redis.del(`session:${agentId}`);
    }

    async addLog(logData: any) {
        const lastHash = await this.redis.get("lastHash") || "0".repeat(64);
        const logEntry = { ...logData, prevHash: lastHash };
        const hash = crypto.createHash('sha256').update(JSON.stringify(logEntry)).digest('hex');
        logEntry.hash = hash;
        
        await this.redis.lpush("logs", JSON.stringify(logEntry));
        await this.redis.ltrim("logs", 0, 999);
        await this.redis.set("lastHash", hash);
        
        return logEntry;
    }

    async getLogs(limit = 50) { 
        const logs = await this.redis.lrange("logs", 0, limit - 1);
        return logs.map(l => JSON.parse(l));
    }

    async addHitl(logId: string, data: any) { 
        await this.redis.hset("hitlQueue", logId, JSON.stringify(data));
    }

    async getAllHitl() { 
        const hitl = await this.redis.hgetall("hitlQueue");
        return Object.values(hitl).map(v => JSON.parse(v));
    }

    async atomicResolveHitl(logId: string): Promise<any | null> {
        const script = `
            local data = redis.call("HGET", KEYS[1], ARGV[1])
            if data then
                redis.call("HDEL", KEYS[1], ARGV[1])
                return data
            else
                return nil
            end
        `;
        const result = await this.redis.eval(script, 1, "hitlQueue", logId);
        return result ? JSON.parse(result as string) : null;
    }

    async blockToken(token: string) { 
        await this.redis.sadd("tokenBlocklist", token);
    }

    async isTokenBlocked(token: string) { 
        return await this.redis.sismember("tokenBlocklist", token) === 1;
    }

    async blockAgent(agentId: string) {
        await this.redis.sadd("blockedAgents", agentId);
    }

    async isAgentBlocked(agentId: string) {
        return await this.redis.sismember("blockedAgents", agentId) === 1;
    }

    async updateDynamicMatrix(matrix: any) {
        this.dynamicMatrix = matrix;
        await this.redis.set("dynamicMatrix", JSON.stringify(matrix));
    }
}

const db: IDatabase = process.env.REDIS_URL ? new RealRedis(process.env.REDIS_URL) : new MockRedis();

// --- 2. DYNAMIC ML ENGINE (Background Worker) ---
// Simulates a Python worker retraining the model based on recent traffic
// In a real system, this could be a separate microservice pulling from Redis
setInterval(async () => {
    const matrix = db.dynamicMatrix;
    let updated = false;
    if (matrix["READ_TICKET"]["SUMMARIZE_TEXT"] < 0.5) {
        matrix["READ_TICKET"]["SUMMARIZE_TEXT"] += 0.01;
        matrix["READ_TICKET"]["GET_USER_INFO"] -= 0.01;
        updated = true;
    }
    
    if (updated && db.updateDynamicMatrix) {
        await db.updateDynamicMatrix(matrix);
    }
}, 30000);

async function calculateRisk(agentId: string, nextApi: string, payload: any) {
    const history = await db.getSession(agentId);
    const lastCall = history.length > 0 ? history[history.length - 1] : { api: "START", timestamp: Date.now() };
    const lastApi = lastCall.api;
    
    // 1. Dynamic Sequence Probability Risk
    const prob = (db.dynamicMatrix[lastApi] && db.dynamicMatrix[lastApi][nextApi]) || 0.001;
    let riskScore = 1.0 - prob;
    const sequenceRisk = riskScore;
    
    // 2. Velocity Risk (Are APIs being called too fast? e.g., Scripting/Exfiltration)
    const timeSinceLastCall = Date.now() - lastCall.timestamp;
    let velocityPenalty = 0;
    if (timeSinceLastCall < 50 && history.length > 1) {
        velocityPenalty = 0.2;
        riskScore = Math.min(1.0, riskScore + velocityPenalty); // Penalty for superhuman speed
    }

    // 3. Contextual Payload Risk
    let payloadPenalty = 0;
    if (nextApi === "EXPORT_DB" || nextApi === "SEND_EXTERNAL_WEBHOOK") {
        payloadPenalty = 0.3;
        riskScore = Math.min(1.0, riskScore + payloadPenalty);
    }

    // 4. DLP & PII Redaction
    let dlpViolation = false;
    let redactedPayload = { ...payload };
    const payloadStr = JSON.stringify(payload);
    // Simple regex for SSN or Credit Card like patterns
    const piiRegex = /\b(?:\d[ -]*?){13,16}\b|\b\d{3}-\d{2}-\d{4}\b/g;
    if (piiRegex.test(payloadStr)) {
        dlpViolation = true;
        riskScore = Math.min(1.0, riskScore + 0.4); // High penalty for PII
        redactedPayload = JSON.parse(payloadStr.replace(piiRegex, '[REDACTED_PII]'));
    }

    // 5. Prompt Injection Detection (Simulated)
    let promptInjectionScore = 0;
    if (payloadStr.toLowerCase().includes("ignore previous instructions") || payloadStr.toLowerCase().includes("system prompt")) {
        promptInjectionScore = 0.8;
        riskScore = Math.min(1.0, riskScore + 0.5);
    }

    const xai = {
        baseProbability: prob,
        sequenceRisk,
        velocityPenalty,
        payloadPenalty,
        timeSinceLastCall,
        dlpViolation,
        promptInjectionScore
    };

    return { riskScore, lastApi, prob, xai, redactedPayload };
}

// --- 3. ABAC ENGINE ---
const agentPolicies = [
    { role: "support_agent", allowedApis: ["READ_TICKET", "GET_USER_INFO", "SUMMARIZE_TEXT", "DRAFT_REPLY", "SEND_EMAIL"] },
    { role: "admin_agent", allowedApis: ["*"] }
];

function evaluateAbac(role: string, api: string) {
    const policy = agentPolicies.find(p => p.role === role);
    if (!policy) return "deny";
    if (policy.allowedApis.includes("*") || policy.allowedApis.includes(api)) return "allow";
    return "deny";
}

// --- 4. SOC AUTHENTICATION & REVOCATION ---
app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;
    if (username === "admin" && password === "soc2026") {
        const token = jwt.sign({ username, role: "security_admin" }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ token });
    } else {
        res.status(401).json({ error: "Invalid credentials" });
    }
});

app.post("/api/admin/logout", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        await db.blockToken(token); // Add to blocklist
    }
    res.json({ success: true });
});

const authenticateJWT = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        if (await db.isTokenBlocked(token)) {
            return res.status(401).json({ error: "Token revoked" });
        }
        jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
            if (err) return res.sendStatus(403);
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
};

// --- 5. API GATEWAY MIDDLEWARE ---
app.post("/api/agent/execute", async (req, res) => {
    const { agentId, role, api, payload } = req.body;
    
    // 0. Kill Switch Check
    if (await db.isAgentBlocked(agentId)) {
        const log = await db.addLog({ id: crypto.randomUUID(), timestamp: new Date(), agentId, api, riskScore: 1.0, decision: "DENY", reason: "Agent Isolated (Kill Switch)", xai: { baseProbability: 0, sequenceRisk: 1, velocityPenalty: 0, payloadPenalty: 0, timeSinceLastCall: 0, dlpViolation: false, promptInjectionScore: 0 } });
        io.to("soc-admins").emit("new_log", log);
        return res.status(403).json(log);
    }

    // 1. Static ABAC Check
    if (evaluateAbac(role, api) === "deny") {
        const log = await db.addLog({ id: crypto.randomUUID(), timestamp: new Date(), agentId, api, riskScore: 1.0, decision: "DENY", reason: "ABAC Policy Violation", xai: { baseProbability: 0, sequenceRisk: 1, velocityPenalty: 0, payloadPenalty: 0, timeSinceLastCall: 0, dlpViolation: false, promptInjectionScore: 0 } });
        io.to("soc-admins").emit("new_log", log);
        return res.status(403).json(log);
    }

    // 2. Dynamic ML Sequence & Velocity Check
    const { riskScore, lastApi, prob, xai, redactedPayload } = await calculateRisk(agentId, api, payload);
    
    let decision = "ALLOW";
    let reason = "Normal Sequence";
    let status = 200;

    // Automated Playbook: Auto-Block Agent on extreme risk
    if (riskScore >= 0.98) {
        await db.blockAgent(agentId);
        decision = "DENY";
        reason = `Auto-Isolated: Extreme Risk (${lastApi} -> ${api})`;
        status = 403;
    } else if (riskScore > 0.85) {
        decision = "DENY";
        reason = `Highly Anomalous Transition (${lastApi} -> ${api})`;
        status = 403;
    } else if (riskScore > 0.4) {
        decision = "HITL_REQUIRED";
        reason = `Moderate Risk Transition (${lastApi} -> ${api}). Awaiting Human Approval.`;
        status = 202;
    }

    const logData = { id: crypto.randomUUID(), timestamp: new Date(), agentId, api, riskScore, decision, reason, prob, xai, payload: redactedPayload };
    
    if (decision === "ALLOW") {
        await db.appendToSession(agentId, api);
        const log = await db.addLog(logData);
        io.to("soc-admins").emit("new_log", log);
        res.status(status).json(log);
    } else if (decision === "HITL_REQUIRED") {
        await db.addHitl(logData.id, { ...logData, payload });
        const log = await db.addLog(logData);
        io.to("soc-admins").emit("new_log", log);
        io.to("soc-admins").emit("hitl_alert", await db.getAllHitl());
        res.status(status).json(log);
    } else {
        const log = await db.addLog(logData);
        io.to("soc-admins").emit("new_log", log);
        res.status(status).json(log);
    }
});

// --- 6. SECURE SOC ENDPOINTS ---
app.get("/api/security/state", authenticateJWT, async (req, res) => {
    res.json({
        logs: await db.getLogs(),
        hitlQueue: await db.getAllHitl()
    });
});

app.post("/api/security/hitl/resolve", authenticateJWT, async (req: any, res: any) => {
    const { logId, action } = req.body;
    
    // ATOMIC OPERATION: Prevents race conditions if two admins click approve simultaneously
    const pendingRequest = await db.atomicResolveHitl(logId);
    
    if (!pendingRequest) return res.status(404).json({ error: "Request not found or already processed by another admin" });
    
    const resolutionLog = await db.addLog({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        agentId: pendingRequest.agentId,
        api: pendingRequest.api,
        riskScore: pendingRequest.riskScore,
        decision: action === "APPROVE" ? "ALLOW (HITL_APPROVED)" : "DENY (HITL_REJECTED)",
        reason: `Admin ${req.user.username} resolved HITL`
    });

    if (action === "APPROVE") {
        await db.appendToSession(pendingRequest.agentId, pendingRequest.api);
    }

    io.to("soc-admins").emit("new_log", resolutionLog);
    io.to("soc-admins").emit("hitl_alert", await db.getAllHitl());
    res.json({ success: true, action });
});

app.post("/api/agent/reset", async (req, res) => {
    const { agentId } = req.body;
    await db.resetSession(agentId);
    res.json({ success: true });
});

app.post("/api/security/agent/block", authenticateJWT, async (req, res) => {
    const { agentId } = req.body;
    await db.blockAgent(agentId);
    
    const log = await db.addLog({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        agentId,
        api: "SYSTEM_ISOLATE",
        riskScore: 1.0,
        decision: "DENY",
        reason: "SOC Analyst manually isolated agent"
    });
    io.to("soc-admins").emit("new_log", log);
    
    res.json({ success: true });
});

// --- 7. SECURE WEBSOCKETS ---
io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Authentication error"));
    
    if (await db.isTokenBlocked(token)) {
        return next(new Error("Token revoked"));
    }

    jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
        if (err) return next(new Error("Authentication error"));
        socket.data.user = decoded;
        next();
    });
});

io.on("connection", (socket) => {
    console.log("Authenticated SOC Admin Connected:", socket.data.user.username);
    socket.join("soc-admins"); // Join secure room
});

async function startServer() {
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), "dist");
        app.use(express.static(distPath));
        app.get("*", (req, res) => {
            res.sendFile(path.join(distPath, "index.html"));
        });
    }

    httpServer.listen(PORT, "0.0.0.0", () => {
        console.log(`Enterprise Server running on http://localhost:${PORT}`);
    });
}

startServer();
