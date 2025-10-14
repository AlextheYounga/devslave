import { Router, Request, Response } from 'express';
import GetAllPromptsController from './controllers/getAllPrompts.controller';
import GetPromptByIdController from './controllers/getPromptById.controller';
import HealthController from './controllers/health.controller';
import CodebaseSetupController from './controllers/codebaseSetup.controller';
import AgentLaunchController from './controllers/agentLaunch.controller';
import AgentWatchdogController from './controllers/agentWatchdog.controller';
import ScanTicketsController from './controllers/scanTickets.controller';

const router = Router();

// Health check
router.get('/health', async (req: Request, res: Response) => {
    return new HealthController(req, res).handleRequest();
});

// Prompt endpoints
router.get('/api/prompts', async (req: Request, res: Response) => {
    return new GetAllPromptsController(req, res).handleRequest();
});

router.get('/api/prompts/:id', async (req: Request, res: Response) => {
    return new GetPromptByIdController(req, res).handleRequest();
});

// Direct action endpoints
router.post('/api/codebase/setup', async (req: Request, res: Response) => {
    return new CodebaseSetupController(req, res).handleRequest();
});

// Launch Codex Agent endpoint
router.post('/api/agent/launch', async (req: Request, res: Response) => {
    return new AgentLaunchController(req, res).handleRequest();
});

// Get Agent Status / Watchdog endpoint
router.post('/api/agent/status', async (req: Request, res: Response) => {
    return new AgentWatchdogController(req, res).handleRequest();
});

// Scan tickets
router.post('/api/tickets/scan', async (req: Request, res: Response) => {
    return new ScanTicketsController(req, res).handleRequest();
});

export default router;