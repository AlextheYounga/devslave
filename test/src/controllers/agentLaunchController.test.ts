import request from "supertest";
import express from "express";
import cors from "cors";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import routes from "../../../src/routes";
import prisma from "../../client";

// Build an in-memory Express app that mirrors server.ts
function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/", routes);
  return app;
}

describe("POST /api/agent/launch (AgentLaunchController)", () => {
  const app = buildApp();
  let tempDir: string;
  let originalScriptPath: string | undefined;

  beforeAll(() => {
    jest.setTimeout(30000);
  });

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-agent-dev-"));
  });

  afterEach(async () => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns 202 and agent info when launch succeeds (skips if tmux unavailable)", async () => {
    // Skip gracefully if tmux is not available in the environment
    try {
      execSync("tmux -V", { stdio: "ignore" });
    } catch {
      console.warn("Skipping agent launch test: tmux not available");
      return; // effectively skip
    }

    // Seed a codebase for the controller to find
    const codebase = await prisma.codebase.create({
      data: { name: "test-agent", path: tempDir },
    });

    const res = await request(app)
      .post("/api/agent/launch")
      .send({
        executionId: "exec-123",
        codebaseId: codebase.id,
        prompt: "Run simple task",
        role: "engineer",
      })
      .expect(202);

    expect(res.body?.success).toBe(true);
    expect(res.body?.message).toBe("Agent started");

    const data = res.body?.data;
    expect(data?.agentId).toBeDefined();
    expect(typeof data?.pid).toBe("number");
    expect(data?.tmuxSession).toMatch(/^agent_/);
    expect(data?.logFile).toMatch(/\/tmp\/sessions\/.+\.jsonl$/);
    expect(data?.sessionId).toBe("123e4567-e89b-12d3-a456-426614174000");

    // Verify DB record persisted with expected fields
    const agent = await prisma.agent.findUnique({ where: { id: data.agentId } });
    expect(agent).toBeTruthy();
    expect(agent?.executionId).toBe("exec-123");
    expect(agent?.role).toBe("engineer");
    expect(agent?.pid).toBe(data.pid);
    expect(agent?.tmuxSession).toBe(data.tmuxSession);
    expect(agent?.sessionId).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(agent?.logFile).toBe(data.logFile);

    // The test launch script creates the log file at /tmp/sessions/<uuid>.jsonl
    expect(fs.existsSync(data.logFile)).toBe(true);

    // Cleanup: kill the tmux session started by the agent to avoid hanging tail -f
    try {
      execSync(`tmux kill-session -t ${data.tmuxSession}`, { stdio: "ignore" });
    } catch (e) {
      // Best-effort cleanup; ignore if already gone
    }
  }, 20000);

  it("returns 400 when codebase is missing or invalid (agent-launch-negative)", async () => {
    const res = await request(app)
      .post("/api/agent/launch")
      .send({
        executionId: "exec-xyz",
        codebaseId: "non-existent",
        prompt: "Hello",
        role: "engineer",
      })
      .expect(400);

    expect(res.body?.success).toBe(false);
    expect(res.body?.error).toContain(
      "prompt, valid codebaseId, role, and executionId are required"
    );
  });
});
