import { Router, Request, Response } from 'express';
import getAllJobsController from './controllers/getAllJobs.controller';
import createJobController from './controllers/createJob.controller';
import getJobByIdController from './controllers/getJobById.controller';
import completeJobController from './controllers/completeJob.controller';
import failJobController from './controllers/failJob.controller';
import nextJobController from './controllers/nextJob.controller';
import getAllPromptsController from './controllers/getAllPrompts.controller';
import getPromptByIdController from './controllers/getPromptById.controller';
import healthController from './controllers/health.controller';

const router = Router();

// Health check
router.get('/health', async (req: Request, res: Response) => {
    return healthController(req, res);
});

// Prompt endpoints
router.get('/api/prompts', async (req: Request, res: Response) => {
    return getAllPromptsController(res);
});

router.get('/api/prompts/:id', async (req: Request, res: Response) => {
    return getPromptByIdController(req, res);
});

// Job endpoints
router.get('/api/jobs', async (req: Request, res: Response) => {
    return getAllJobsController(res);
});

router.post('/api/jobs', async (req: Request, res: Response) => {
    return createJobController(req, res);
});

router.get('/api/jobs/:id', async (req: Request, res: Response) => {
    return getJobByIdController(req, res);
});

router.patch('/api/jobs/:id/complete', async (req: Request, res: Response) => {
    return completeJobController(req, res);
});

router.patch('/api/jobs/:id/fail', async (req: Request, res: Response) => {
    return failJobController(req, res);
});

router.post('/api/jobs/process-next', async (req: Request, res: Response) => {
    return nextJobController(req, res);
});

export default router;