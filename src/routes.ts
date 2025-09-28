import { Router, Request, Response } from 'express';
// Job queue routes removed in favor of direct handler endpoints
import GetAllPromptsController from './controllers/getAllPrompts.controller';
import GetPromptByIdController from './controllers/getPromptById.controller';
import HealthController from './controllers/health.controller';
import CodebaseSetupController from './controllers/codebaseSetup.controller';

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

export default router;