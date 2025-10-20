import request from "supertest";
import express from "express";
import cors from "cors";
import { exec } from "child_process";
import { promisify } from "util";
import routes from "../../../src/routes";
import prisma from "../../client";

const execAsync = promisify(exec);

// Build an in-memory Express app that mirrors server.ts
function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/", routes);
  return app;
}

describe("POST /api/agent/:id/monitor (AgentMonitorController)", () => {
  const app = buildApp();

  beforeAll(() => {
    jest.setTimeout(30000);
  });

  beforeEach(async () => {
    // Clean Agents for deterministic assertions
    await prisma.agent.deleteMany();
  });

  it("monitors agent and updates status from LAUNCHED to RUNNING to COMPLETED", async () => {
    // Create a mock tmux session name
    const mockSessionName = `test-session-${Date.now()}`;
    
    // Seed an Agent with a tmux session
    const agent = await prisma.agent.create({
      data: {
        executionId: "exec-monitor",
        role: "engineer",
        status: "LAUNCHED",
        tmuxSession: mockSessionName,
      },
    });

    // Mock the tmux has-session command to simulate session lifecycle
    const originalExec = require("child_process").exec;
    let callCount = 0;
    const mockExec = jest.fn((cmd: string, callback: any) => {
      callCount++;
      if (cmd.includes(`tmux has-session -t ${mockSessionName}`)) {
        // First few calls: session exists (agent is running)
        // Last call: session doesn't exist (agent completed)
        if (callCount <= 2) {
          callback(null, "session exists");
        } else {
          callback(new Error("session not found"), "");
        }
      } else {
        originalExec(cmd, callback);
      }
    });
    
    require("child_process").exec = mockExec;

    // Start monitoring - this should complete when the mock session "dies"
    const monitorPromise = request(app)
      .post(`/api/agent/${agent.id}/monitor`)
      .expect(200);

    const res = await monitorPromise;

    expect(res.body?.success).toBe(true);
    expect(res.body?.message).toContain("Agent completed with status: COMPLETED");

    // Verify DB updated to COMPLETED
    const finalAgent = await prisma.agent.findUnique({ where: { id: agent.id } });
    expect(finalAgent?.status).toBe("COMPLETED");

    // Restore original exec
    require("child_process").exec = originalExec;
  });

  it("returns 500 when agent does not exist", async () => {
    const res = await request(app)
      .post("/api/agent/non-existent-id/monitor")
      .expect(500);

    expect(res.body?.success).toBe(false);
    expect(res.body?.error).toBeDefined();
  });

  it("handles agent without tmux session gracefully", async () => {
    // Create agent without tmux session
    const agent = await prisma.agent.create({
      data: {
        executionId: "exec-no-tmux",
        role: "engineer", 
        status: "LAUNCHED",
        tmuxSession: null,
      },
    });

    // Mock tmux command to fail immediately for null session
    const originalExec = require("child_process").exec;
    const mockExec = jest.fn((cmd: string, callback: any) => {
      if (cmd.includes("tmux has-session -t null")) {
        callback(new Error("session not found"), "");
      } else {
        originalExec(cmd, callback);
      }
    });
    
    require("child_process").exec = mockExec;

    const res = await request(app)
      .post(`/api/agent/${agent.id}/monitor`)
      .expect(200);

    expect(res.body?.success).toBe(true);
    expect(res.body?.message).toContain("Agent completed with status: COMPLETED");

    // Should immediately mark as completed since no session exists
    const finalAgent = await prisma.agent.findUnique({ where: { id: agent.id } });
    expect(finalAgent?.status).toBe("COMPLETED");

    // Restore original exec
    require("child_process").exec = originalExec;
  });
});
