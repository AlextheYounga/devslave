import { Router, Request, Response } from "express";
import HealthController from "../api/controllers/health.controller";
import CodebaseController from "../api/controllers/codebase.controller";
import AgentController from "../api/controllers/agent.controller";
import TicketsController from "../api/controllers/tickets.controller";
import GitController from "../api/controllers/git.controller";
import DashboardController from "./controllers/dashboard.controller";
import UtilityController from "../api/controllers/utility.controller";
import EventsController from "../api/controllers/events.controller";

const router = Router();

// Health check
router.get("/health", async (req: Request, res: Response) => {
    return new HealthController(req, res).check();
});

// Events
router.get("/api/events", async (req: Request, res: Response) => {
    return new EventsController(req, res).list();
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

router.post("/api/codebase/:id/clone", async (req: Request, res: Response) => {
    return new CodebaseController(req, res).clone();
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

// Dashboard stats
router.get("/api/dashboard/stats", async (req: Request, res: Response) => {
    return new DashboardController(req, res).getDashboardStats();
});

// Utility endpoints
router.post("/api/utilities/app-shell", async (req: Request, res: Response) => {
    return new UtilityController(req, res).openAppShell();
});

router.post("/api/utilities/open-vscode", async (req: Request, res: Response) => {
    return new UtilityController(req, res).openVsCode();
});

router.post("/api/utilities/codex-login", async (req: Request, res: Response) => {
    return new UtilityController(req, res).loginCodex();
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
router.get("/api/agent/:id/detail", async (req: Request, res: Response) => {
    return new AgentController(req, res).getById();
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
router.get("/api/tickets", async (req: Request, res: Response) => {
    return new TicketsController(req, res).list();
});
router.get("/api/tickets/:id", async (req: Request, res: Response) => {
    return new TicketsController(req, res).scanTicket();
});
router.get("/api/tickets/:id/detail", async (req: Request, res: Response) => {
    return new TicketsController(req, res).getById();
});
router.post("/api/tickets/scan", async (req: Request, res: Response) => {
    return new TicketsController(req, res).scan();
});

export default router;
