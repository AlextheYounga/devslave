import { Router, Request, Response } from "express";
import HealthController from "../api/controllers/health.controller";
import CodebaseController from "../api/controllers/codebase.controller";
import AgentController from "../api/controllers/agent.controller";
import TicketsController from "../api/controllers/tickets.controller";
import GitController from "../api/controllers/git.controller";

const router = Router();

// Health check
router.get("/health", async (req: Request, res: Response) => {
    return new HealthController(req, res).check();
});

// Codebase endpoints
router.post("/api/codebase/setup", async (req: Request, res: Response) => {
    return new CodebaseController(req, res).setup();
});

router.get("/api/codebase/:id", async (req: Request, res: Response) => {
    return new CodebaseController(req, res).get();
});

router.put("/api/codebase/:id/phase", async (req: Request, res: Response) => {
    return new CodebaseController(req, res).updatePhase();
});

router.get("/api/codebases", async (req: Request, res: Response) => {
    return new CodebaseController(req, res).getAll();
});

// Git endpoints
router.post("/api/git/commit", async (req: Request, res: Response) => {
    return new GitController(req, res).commit();
});

router.post("/api/git/switch-branch", async (req: Request, res: Response) => {
    return new GitController(req, res).switchBranch();
});

router.post("/api/git/complete-feature", async (req: Request, res: Response) => {
    return new GitController(req, res).completeFeature();
});

// Agent Endpoints
router.get("/api/agents", async (req: Request, res: Response) => {
    return new AgentController(req, res).list();
});
router.post("/api/agent/start", async (req: Request, res: Response) => {
    return new AgentController(req, res).start();
});

router.post("/api/agent/:id/watch", async (req: Request, res: Response) => {
    return new AgentController(req, res).watch();
});

router.get("/api/agent/:id/status", async (req: Request, res: Response) => {
    return new AgentController(req, res).ping();
});

router.post("/api/agent/execute", async (req: Request, res: Response) => {
    return new AgentController(req, res).startAndWait();
});

router.post("/api/agent/execute-async", async (req: Request, res: Response) => {
    return new AgentController(req, res).startAndNotify();
});

router.post("/api/agent/:id/kill", async (req: Request, res: Response) => {
    return new AgentController(req, res).kill();
});

// Ticket endpoints
router.get("/api/tickets/:id", async (req: Request, res: Response) => {
    return new TicketsController(req, res).scanTicket();
});
router.post("/api/tickets/scan", async (req: Request, res: Response) => {
    return new TicketsController(req, res).scan();
});

export default router;
