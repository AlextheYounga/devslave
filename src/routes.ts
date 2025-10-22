import { Router, Request, Response } from 'express';
import HealthController from './controllers/health.controller';
import CodebaseController from './controllers/codebase.controller';
import AgentController from './controllers/agent.controller';
import TicketsController from './controllers/tickets.controller';

const router = Router();

// Health check
router.get('/health', async (req: Request, res: Response) => {
    return new HealthController(req, res).check();
});

// Codebase endpoints
router.get('/api/codebase/:id', async (req: Request, res: Response) => {
    return new CodebaseController(req, res).get();
});

router.post('/api/codebase/setup', async (req: Request, res: Response) => {
    return new CodebaseController(req, res).setup();
});

// Agent Endpoints
router.post('/api/agent/start', async (req: Request, res: Response) => {
    return new AgentController(req, res).start();
});

router.post('/api/agent/:id/watch', async (req: Request, res: Response) => {
    return new AgentController(req, res).watch();
});

router.get('/api/agent/:id/status', async (req: Request, res: Response) => {
    return new AgentController(req, res).ping();
});

router.post('/api/agent/execute', async (req: Request, res: Response) => {
    return new AgentController(req, res).startAndWait();
});

router.post('/api/agent/execute-async', async (req: Request, res: Response) => {
    return new AgentController(req, res).startAndNotify();
});

// Ticket endpoints
router.post('/api/tickets/scan', async (req: Request, res: Response) => {
    return new TicketsController(req, res).scan();
});

export default router;