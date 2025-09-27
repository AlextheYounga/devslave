import request from 'supertest';
import express from 'express';
import cors from 'cors';
import routes from '../../src/routes';
import { prisma } from '../../src/prisma';

// Build an in-memory Express app that mirrors server.ts without starting the worker
function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/', routes);
  return app;
}

describe('POST /api/jobs', () => {
  const app = buildApp();

  it('creates a job and returns 201 with the job payload', async () => {
    const payload = { foo: 'bar', n: 42 };

    const res = await request(app)
      .post('/api/jobs')
      .send({ type: 'testJob', payload, priority: 2 })
      .expect(201);

    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.id).toBeDefined();
    expect(res.body?.data?.type).toBe('testJob');
    expect(res.body?.data?.priority).toBe(2);

    // Verify DB state
    const job = await prisma.job.findUnique({ where: { id: res.body.data.id } });
    expect(job).not.toBeNull();
    expect(job?.status).toBe('pending');
    expect(job?.payload).toEqual(payload);
  });

  it('returns 400 when type is missing', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .send({ payload: { a: 1 } })
      .expect(400);

    expect(res.body?.success).toBe(false);
    expect(res.body?.error).toMatch(/Job type is required/i);
  });

  it('accepts job type as class name (e.g., StartProjectJob)', async () => {
    const payload = { 
      name: 'Test Project',
      projectPath: '/tmp/test',
      params: { setup: 'node' }
    };

    const res = await request(app)
      .post('/api/jobs')
      .send({ type: 'StartProjectJob', payload, priority: 1 })
      .expect(201);

    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.type).toBe('StartProjectJob');

    // Verify DB state
    const job = await prisma.job.findUnique({ where: { id: res.body.data.id } });
    expect(job).not.toBeNull();
    expect(job?.type).toBe('StartProjectJob');
    expect(job?.payload).toEqual(payload);
  });
});
