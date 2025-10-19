import request from "supertest";
import express from "express";
import cors from "cors";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as cp from "child_process";
import AgentProcessHandler from "../../../src/handlers/agentProcess.handler";
import routes from "../../../src/routes";
import prisma from "../../client";

// Mock child_process.spawn to a jest.fn we can control
jest.mock("child_process", () => {
  const actual = jest.requireActual("child_process");
  return {
    ...actual,
    spawn: jest.fn(),
  };
});

// We'll spy on spawn; execSync will run normally for find(1)

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
  let originalHome: string | undefined;
  let tempHome: string;

  // Mock data for consistent testing
  const sessionId = "123e4567-e89b-12d3-a456-426614174000";
  // We don't know the rollout timestamped filename exactly; assert by pattern
  const homeSessionsDir = () => path.join(process.env.HOME!, ".codex", "sessions");
  const expectLogFileMatches = (p: string) => {
    expect(p).toContain(homeSessionsDir());
    expect(p.endsWith(`${sessionId}.jsonl`) || p.includes(`${sessionId}.jsonl`) || p.includes(`${sessionId}`)).toBe(true);
    expect(p.endsWith(".jsonl")).toBe(true);
  };

  beforeAll(() => {
    jest.setTimeout(5000);
    // Set test script path to use fixtures
    originalScriptPath = process.env.SCRIPT_PATH;
    process.env.SCRIPT_PATH = "test/fixtures/scripts";
    // Isolate HOME so ~/.codex is under a temp directory
    originalHome = process.env.HOME;
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "home-"));
    process.env.HOME = tempHome;
  });

  afterAll(() => {
    // Restore original script path
    if (originalScriptPath !== undefined) {
      process.env.SCRIPT_PATH = originalScriptPath;
    } else {
      delete process.env.SCRIPT_PATH;
    }
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }
    // Remove the temporary HOME directory to avoid clutter
    try {
      fs.rmSync(tempHome, { recursive: true, force: true });
    } catch {}
  });

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-agent-dev-"));

    // Ensure ~/.codex exists so the handler's baseline scan doesn't fail if the directory is missing
    fs.mkdirSync(path.join(process.env.HOME!, ".codex"), { recursive: true });

    // Mock spawn to avoid actually running tmux; create a fake session file
  // We will compute the created path dynamically after spawn runs; no fixed path
    (cp.spawn as unknown as jest.Mock).mockImplementation(
      (command: any, args?: readonly string[], options?: any) => {
        // Mirror fixture behavior: create nested date-based rollout file
        const year = new Date().getFullYear().toString().padStart(4, "0");
        const month = (new Date().getMonth() + 1).toString().padStart(2, "0");
        const day = new Date().getDate().toString().padStart(2, "0");
        const dir = path.join(homeSessionsDir(), year, month, day);
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, `rollout-TEST-${sessionId}.jsonl`);
        fs.writeFileSync(file, "");
        return {
          unref: () => {},
          stdout: null,
          stderr: null,
          pid: 0,
          on: () => ({} as any),
          once: () => ({} as any),
        } as unknown as cp.ChildProcess;
      }
    );
  });

  afterEach(async () => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  jest.resetAllMocks();
    // Clean up mock log file if it exists
    try {
      const p = path.join(process.env.HOME!, ".codex", "sessions");
      fs.rmSync(p, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("returns 202 and agent info when launch succeeds", async () => {
    // Seed a codebase for the controller to find
    const codebase = await prisma.codebase.create({
      data: { name: "test-agent", path: tempDir },
    });

    const res = await request(app).post("/api/agent/launch").send({
      executionId: "exec-123",
      codebaseId: codebase.id,
      prompt: "Run simple task",
      role: "engineer",
    });

    expect(res.status).toBe(202);
    expect(res.body?.success).toBe(true);
    expect(res.body?.message).toBe("Agent started");

    const data = res.body?.data;
    expect(data?.agentId).toBeDefined();
    expect(data?.tmuxSession).toMatch(/^agent_/);
  expectLogFileMatches(data?.logFile);
  expect(data?.sessionId).toBe(sessionId);

    // Verify DB record persisted with expected fields
    const agent = await prisma.agent.findUnique({ where: { id: data.agentId } });
    expect(agent).toBeTruthy();
    expect(agent?.executionId).toBe("exec-123");
    expect(agent?.role).toBe("engineer");
    expect(agent?.tmuxSession).toMatch(/^agent_/);
  expect(agent?.sessionId).toBe(sessionId);
  expectLogFileMatches(agent?.logFile!);

    // Verify the mock log file was created
  expect(fs.existsSync(data?.logFile)).toBe(true);

    // No lsof/pgrep/tmux expectations anymore; spawn is used and we stubbed it
  });

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

  it("returns 500 when tmux session creation fails", async () => {
    // Seed a codebase for the controller to find
    const codebase = await prisma.codebase.create({
      data: { name: "test-agent", path: tempDir },
    });

    // Mock spawn to fail when launching script
    (cp.spawn as unknown as jest.Mock).mockImplementation(() => {
      throw new Error("tmux session creation failed");
    });

    const res = await request(app)
      .post("/api/agent/launch")
      .send({
        executionId: "exec-failure",
        codebaseId: codebase.id,
        prompt: "Run simple task",
        role: "engineer",
      })
      .expect(500);

    expect(res.body?.success).toBe(false);
    expect(res.body?.error).toContain("tmux session creation failed");
  });

  it("returns 500 when tmux session timeout occurs", async () => {
    // Seed a codebase for the controller to find
    const codebase = await prisma.codebase.create({
      data: { name: "test-agent", path: tempDir },
    });

    // Do not create any log file and mock getAgentLogFile to throw quickly
    jest
      .spyOn(AgentProcessHandler.prototype as any, "getAgentLogFile")
      .mockImplementation(async () => {
        throw new Error("Unable to determine new log file for agent. Found 0 new files.");
      });

    const res = await request(app)
      .post("/api/agent/launch")
      .send({
        executionId: "exec-timeout",
        codebaseId: codebase.id,
        prompt: "Run simple task",
        role: "engineer",
      })
      .expect(500);

    expect(res.body?.success).toBe(false);
    expect(res.body?.error).toContain("Unable to determine new log file for agent");
  });
});
