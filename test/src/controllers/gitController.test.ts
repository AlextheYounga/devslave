import request from "supertest";
import express from "express";
import cors from "cors";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as cp from "child_process";
import routes from "../../../src/routes";
import prisma from "../../client";

// Mock child_process.execSync to avoid running actual git commands
jest.mock("child_process", () => {
  const actual = jest.requireActual("child_process");
  return {
    ...actual,
    execSync: jest.fn(),
  };
});

// Build an in-memory Express app that mirrors server.ts
function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/", routes);
  return app;
}

describe("GitController", () => {
  const app = buildApp();
  let tempDir: string;
  let originalScriptPath: string | undefined;

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
    // Create temp directory before each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-git-"));
  });

  afterEach(async () => {
    // Only clean up if tempDir exists
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    jest.resetAllMocks();
  });

  describe("POST /api/commands/git/commit", () => {
    it("returns 200 and executes git commit when valid parameters provided", async () => {
      // Mock execSync to return fixture script output
      (cp.execSync as unknown as jest.Mock).mockImplementation(
        (command: string, options?: any) => {
          return Buffer.from(
            "Mock git commit executed\nSuccessfully committed changes\n"
          );
        }
      );

      // Seed a codebase for the controller to find
      const codebase = await prisma.codebase.create({
        data: { name: "test-repo", path: tempDir },
      });

      const res = await request(app).post("/api/commands/git/commit").send({
        codebaseId: codebase.id,
        message: "Test commit message",
      });

      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);
      expect(res.body?.data?.stdout).toContain("Mock git commit executed");
      expect(res.body?.data?.stdout).toContain("Successfully committed changes");

      // Verify execSync was called with correct parameters
      expect(cp.execSync).toHaveBeenCalledWith(
        expect.stringMatching(/git_commit\.sh.*"Test commit message"/)
      );
      expect(cp.execSync).toHaveBeenCalledWith(expect.stringContaining(tempDir));
    });

    it("uses default commit message when message not provided", async () => {
      // Mock execSync to return fixture script output
      (cp.execSync as unknown as jest.Mock).mockImplementation(
        (command: string, options?: any) => {
          return Buffer.from(
            "Mock git commit executed\nSuccessfully committed changes\n"
          );
        }
      );

      const codebase = await prisma.codebase.create({
        data: { name: "test-repo", path: tempDir },
      });

      const res = await request(app).post("/api/commands/git/commit").send({
        codebaseId: codebase.id,
      });

      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);

      // Verify execSync was called with default message
      expect(cp.execSync).toHaveBeenCalledWith(
        expect.stringMatching(/git_commit\.sh.*"Automated commit"/)
      );
    });

    it("returns 500 when codebase not found", async () => {
      const res = await request(app).post("/api/commands/git/commit").send({
        codebaseId: "non-existent-id",
        message: "Test commit",
      });

      expect(res.status).toBe(500);
      expect(res.body?.success).toBe(false);
      expect(res.body?.error).toContain("Codebase with id non-existent-id not found");
    });
  });

  describe("POST /api/commands/git/create-branch", () => {
    it("returns 200 and creates branch when valid parameters provided", async () => {
      // Mock execSync to return fixture script output
      (cp.execSync as unknown as jest.Mock).mockImplementation(
        (command: string, options?: any) => {
          return Buffer.from(
            "Mock git branch creation executed\nSuccessfully created branch\n"
          );
        }
      );

      const codebase = await prisma.codebase.create({
        data: { name: "test-repo", path: tempDir },
      });

      const res = await request(app).post("/api/commands/git/create-branch").send({
        codebaseId: codebase.id,
        name: "feature/new-feature",
      });

      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);
      expect(res.body?.data?.stdout).toContain("Mock git branch creation executed");
      expect(res.body?.data?.stdout).toContain("Successfully created branch");

      // Verify execSync was called with correct parameters
      expect(cp.execSync).toHaveBeenCalledWith(
        expect.stringMatching(/git_branch\.sh.*"feature\/new-feature"/)
      );
      expect(cp.execSync).toHaveBeenCalledWith(expect.stringContaining(tempDir));
    });

    it("returns 500 when codebase not found", async () => {
      const res = await request(app).post("/api/commands/git/create-branch").send({
        codebaseId: "non-existent-id",
        name: "test-branch",
      });

      expect(res.status).toBe(500);
      expect(res.body?.success).toBe(false);
      expect(res.body?.error).toContain("Codebase with id non-existent-id not found");
    });
  });

  describe("error handling", () => {
    it("returns 500 when execSync throws an error", async () => {
      // Mock execSync to throw an error
      (cp.execSync as unknown as jest.Mock).mockImplementation(() => {
        throw new Error("Git command failed");
      });

      const codebase = await prisma.codebase.create({
        data: { name: "test-repo", path: tempDir },
      });

      const res = await request(app).post("/api/commands/git/commit").send({
        codebaseId: codebase.id,
        message: "Test commit",
      });

      expect(res.status).toBe(500);
      expect(res.body?.success).toBe(false);
      expect(res.body?.error).toContain("Git command failed");
    });
  });
});
