import request from "supertest";
import express from "express";
import cors from "cors";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import routes from "../../../src/routes";
import prisma from "../../client";
import { SENTINEL } from "../../../src/constants";

// Build an in-memory Express app that mirrors server.ts
function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/", routes);
  return app;
}

describe("POST /api/agent/status (AgentWatchdogController)", () => {
  const app = buildApp();
  let tempDir: string;

  beforeAll(() => {
    jest.setTimeout(30000);
  });

  beforeEach(async () => {
    // Fresh temp dir and clean Agents for deterministic assertions
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-watchdog-"));
    await prisma.agent.deleteMany();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns 202 and RUNNING status when session log has no sentinel", async () => {
    // Prepare a JSONL log without the sentinel
    const logPath = path.join(tempDir, `session-${Date.now()}.jsonl`);
    const jsonl = JSON.stringify({ step: 1, msg: "working" }) + "\n"; // one valid JSON line
    fs.writeFileSync(logPath, jsonl, "utf-8");

    // Seed an Agent pointing at the log; pid unset so watchdog won't try to kill anything
    const agent = await prisma.agent.create({
      data: {
        executionId: "exec-run",
        role: "engineer",
        status: "LAUNCHED",
        logFile: logPath,
        pid: null,
        tmuxSession: null,
      },
    });

    const res = await request(app)
      .post("/api/agent/status")
      .send({
        executionId: "exec-run",
        agentId: agent.id,
      })
      .expect(202);

    expect(res.body?.success).toBe(true);
    expect(res.body?.message).toContain("Agent status: RUNNING");
    expect(res.body?.data?.agentId ?? res.body?.data?.agent?.id).toBeDefined();

    // Verify DB updated to RUNNING and context parsed with only valid JSON lines
    const current = await prisma.agent.findUnique({ where: { id: agent.id } });
    expect(current?.status).toBe("RUNNING");
    const context = (current?.context as any[]) ?? [];
    expect(Array.isArray(context)).toBe(true);
    expect(context.length).toBe(1);
    expect(context[0]?.step).toBe(1);
  });

  it("returns 202 and COMPLETED status when session log contains sentinel", async () => {
    // Prepare a JSONL log with the sentinel to indicate completion
    const logPath = path.join(tempDir, `session-${Date.now()}-done.jsonl`);
    const lines = [
      JSON.stringify({ step: 1, msg: "phase A" }),
      SENTINEL, // not JSON; should be ignored by parser but used for completion detection
    ].join("\n");
    fs.writeFileSync(logPath, lines + "\n", "utf-8");

    const agent = await prisma.agent.create({
      data: {
        executionId: "exec-done",
        role: "engineer",
        status: "LAUNCHED",
        logFile: logPath,
        pid: null, // ensure watchdog doesn't try to kill a real PID
        tmuxSession: null,
      },
    });

    const res = await request(app)
      .post("/api/agent/status")
      .send({
        executionId: "exec-done",
        agentId: agent.id,
      })
      .expect(202);

    expect(res.body?.success).toBe(true);
    expect(res.body?.message).toContain("Agent status: COMPLETED");

    const current = await prisma.agent.findUnique({ where: { id: agent.id } });
    expect(current?.status).toBe("COMPLETED");
    const context = (current?.context as any[]) ?? [];
    expect(context.length).toBe(1);
    expect(context[0]?.msg).toBe("phase A");
  });

  it("returns 400 when agentId or executionId missing (watchdog-negative)", async () => {
    const res1 = await request(app)
      .post("/api/agent/status")
      .send({ agentId: "abc" })
      .expect(400);
    expect(res1.body?.success).toBe(false);
    expect(res1.body?.error).toContain("agentId and executionId are required");

    const res2 = await request(app)
      .post("/api/agent/status")
      .send({ executionId: "exec-x" })
      .expect(400);
    expect(res2.body?.success).toBe(false);
    expect(res2.body?.error).toContain("agentId and executionId are required");
  });

  it("returns 400 when agent does not exist", async () => {
    const res = await request(app)
      .post("/api/agent/status")
      .send({ executionId: "exec-404", agentId: "non-existent" })
      .expect(400);

    expect(res.body?.success).toBe(false);
    expect(res.body?.error).toContain("Valid agent is required");
  });
});
