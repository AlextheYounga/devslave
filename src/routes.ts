import { Router, Request, Response } from 'express';
import HealthController from './controllers/health.controller';
import GetCodebaseController from './controllers/getCodebase.controller';
import CodebaseSetupController from './controllers/codebaseSetup.controller';
import AgentLaunchController from './controllers/agentLaunch.controller';
import AgentMonitorController from './controllers/agentMonitor.controller';
import AgentStatusController from './controllers/agentStatus.controller';
import AgentRunSyncController from './controllers/agentRunSync.controller';
import AgentRunAsyncController from './controllers/agentRunSync.controller';
import ScanTicketsController from './controllers/scanTickets.controller';

const router = Router();

// Health check
router.get('/health', async (req: Request, res: Response) => {
    return new HealthController(req, res).handleRequest();
});

// Codebase endpoints
router.get('/api/codebase/:id', async (req: Request, res: Response) => {
    return new GetCodebaseController(req, res).handleRequest();
});

router.post('/api/codebase/setup', async (req: Request, res: Response) => {
    return new CodebaseSetupController(req, res).handleRequest();
});

// Agent Endpoints
router.post('/api/agent/launch', async (req: Request, res: Response) => {
    return new AgentLaunchController(req, res).handleRequest();
});

router.post('/api/agent/:id/monitor', async (req: Request, res: Response) => {
    return new AgentMonitorController(req, res).handleRequest();
});

router.get('/api/agent/:id/status', async (req: Request, res: Response) => {
    return new AgentStatusController(req, res).handleRequest();
});

router.post('/api/agent/run-sync', async (req: Request, res: Response) => {
    return new AgentRunSyncController(req, res).handleRequest();
});

router.post('/api/agent/run-async', async (req: Request, res: Response) => {
    return new AgentRunAsyncController(req, res).handleRequest();
});

// Scan tickets
router.post('/api/tickets/scan', async (req: Request, res: Response) => {
    return new ScanTicketsController(req, res).handleRequest();
});

export default router;