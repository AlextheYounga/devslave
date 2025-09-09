import express from 'express';
import cors from 'cors';
import routes from './routes';
import { JOB_QUEUE } from './queue';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/', routes);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully');
  await JOB_QUEUE.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully');
  await JOB_QUEUE.close();
  process.exit(0);
});

app.listen(port, () => {
  console.log(`Job queue API server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`API endpoints:`);
  console.log(`  GET    /api/jobs           - List all jobs`);
  console.log(`  GET    /api/jobs/:id       - Get job by ID`);
  console.log(`  POST   /api/jobs           - Create new job`);
  console.log(`  PATCH  /api/jobs/:id/complete - Mark job as completed`);
  console.log(`  PATCH  /api/jobs/:id/fail  - Mark job as failed`);
  console.log(`  POST   /api/jobs/process-next - Process next job in queue`);
});
