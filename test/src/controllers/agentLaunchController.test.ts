import request from "supertest";
import express from "express";
import cors from "cors";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import routes from "../../../src/routes";
import prisma from "../../client";

// Mock execSync for controlled test behavior
jest.mock("child_process", () => ({
  execSync: jest.fn(),
}));

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

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

  // Mock data for consistent testing
  const mockPid = 12345;
  const mockPanePid = 12340;
  const mockLogFile = "/tmp/sessions/123e4567-e89b-12d3-a456-426614174000.jsonl";

  beforeAll(() => {
    jest.setTimeout(5000);
    // Set test script path to use fixtures
    originalScriptPath = process.env.SCRIPT_PATH;
    process.env.SCRIPT_PATH = "test/fixtures/scripts";
  });

  afterAll(() => {
    // Restore original script path
    if (originalScriptPath !== undefined) {
      process.env.SCRIPT_PATH = originalScriptPath;
    } else {
      delete process.env.SCRIPT_PATH;
    }
  });

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-agent-dev-"));
    
    // Reset all mocks
    mockExecSync.mockReset();
    
    // Track the dynamic session name that gets created
    let currentSessionName = "";
    
    // Mock the main script execution (launch-agent.sh)
    mockExecSync.mockImplementation((command: string) => {
      const cmd = command.toString();
      
      if (cmd.includes("launch-agent.sh")) {
        // Extract session name from the command
        const match = cmd.match(/"([^"]*agent_[^"]*)"$/);
        if (match && match[1]) {
          currentSessionName = match[1];
        }
        // Create the mock log file that the script would create
        fs.mkdirSync("/tmp/sessions", { recursive: true });
        fs.writeFileSync(mockLogFile, "");
        return Buffer.from(`OK: ${currentSessionName}`);
      }
      
      if (cmd.includes("tmux list-sessions")) {
        // Return the dynamically created session name
        return Buffer.from(`${currentSessionName}\n`);
      }
      
      if (cmd.includes("tmux list-panes")) {
        return Buffer.from(`${mockPanePid}\n`);
      }
      
      if (cmd.includes("pgrep -P")) {
        return Buffer.from(`${mockPid}\n`);
      }
      
      if (cmd.includes("lsof -p")) {
        return Buffer.from(`codex   ${mockPid}    user   3r   REG    1,4      0  123456 ${mockLogFile}`);
      }
      
      return Buffer.from("");
    });
  });

  afterEach(async () => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    
    // Clean up mock log file if it exists
    try {
      fs.rmSync("/tmp/sessions", { recursive: true, force: true });
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
    expect(data?.pid).toBe(mockPid);
    expect(data?.tmuxSession).toMatch(/^agent_/);
    expect(data?.logFile).toBe(mockLogFile);
    expect(data?.sessionId).toBe("123e4567-e89b-12d3-a456-426614174000");

    // Verify DB record persisted with expected fields
    const agent = await prisma.agent.findUnique({ where: { id: data.agentId } });
    expect(agent).toBeTruthy();
    expect(agent?.executionId).toBe("exec-123");
    expect(agent?.role).toBe("engineer");
    expect(agent?.pid).toBe(mockPid);
    expect(agent?.tmuxSession).toMatch(/^agent_/);
    expect(agent?.sessionId).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(agent?.logFile).toBe(mockLogFile);

    // Verify the mock log file was created
    expect(fs.existsSync(mockLogFile)).toBe(true);

    // Verify correct script calls were made
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining("test/fixtures/scripts/launch-agent.sh")
    );
    expect(mockExecSync).toHaveBeenCalledWith("tmux list-sessions");
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining("tmux list-panes")
    );
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining("pgrep -P")
    );
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringContaining("lsof -p")
    );
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

    // Mock execSync to fail on script execution
    mockExecSync.mockImplementation(() => {
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

    // Mock execSync to succeed for script but fail for tmux list-sessions
    mockExecSync.mockImplementation((command: string) => {
      const cmd = command.toString();
      
      if (cmd.includes("launch-agent.sh")) {
        return Buffer.from("OK: agent_test_session");
      }
      
      if (cmd.includes("tmux list-sessions")) {
        // Return empty to simulate session not found, causing timeout
        return Buffer.from("");
      }
      
      return Buffer.from("");
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
    expect(res.body?.error).toContain("Timed out waiting for tmux session");
  });
});
