import { Router, Request, Response } from 'express';
import HealthController from './controllers/health.controller';
import CodebaseSetupController from './controllers/codebaseSetup.controller';
import AgentLaunchController from './controllers/agentLaunch.controller';
import AgentMonitorController from './controllers/agentMonitor.controller';
import AgentExecuteController from './controllers/agentExecute.controller';
import ScanTicketsController from './controllers/scanTickets.controller';

const router = Router();

// Health check
router.get('/health', async (req: Request, res: Response) => {
    return new HealthController(req, res).handleRequest();
});

// Direct action command endpoints
router.post('/api/commands/codebase/setup', async (req: Request, res: Response) => {
    return new CodebaseSetupController(req, res).handleRequest();
});

// Agent Endpoints
router.post('/api/agent/launch', async (req: Request, res: Response) => {
    return new AgentLaunchController(req, res).handleRequest();
});

router.post('/api/agent/:id/monitor', async (req: Request, res: Response) => {
    return new AgentMonitorController(req, res).handleRequest();
});

router.post('/api/agent/execute', async (req: Request, res: Response) => {
    return new AgentExecuteController(req, res).handleRequest();
});

// Scan tickets
router.post('/api/tickets/scan', async (req: Request, res: Response) => {
    return new ScanTicketsController(req, res).handleRequest();
});

export default router;