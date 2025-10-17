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

describe("POST /api/codebase/setup (SetupCodebaseController)", () => {
  const app = buildApp();
  let tempDir: string;
  let folderName: string;

  beforeEach(() => {
    jest.setTimeout(20000);
    // Generate unique folder name for this test
    folderName = `test-setup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // The controller will create this path: os.tmpdir() + folderName
    tempDir = path.join(os.tmpdir(), folderName);
  });

  afterEach(() => {
    // Clean up the directory created by the controller
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("executes the setup script and returns 200 with IDs and stdout", async () => {
    const prompt = "This is a test project for unit testing.";
    
    const res = await request(app)
      .post("/api/codebase/setup")
      .send({
        name: "test-project",
        folderName,
        prompt,
        setup: "test",
      })
      .expect(200);

    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.codebaseId).toBeDefined();
    expect(res.body?.data?.branchId).toBeDefined();
    expect(res.body?.data?.stdout).toContain("Project setup completed successfully");

    // Verify side effects on filesystem
    expect(fs.existsSync(path.join(tempDir, "agent"))).toBe(true);
    
    // Verify PROJECT.md file is created with correct content
    const projectMdPath = path.join(tempDir, "agent", "PROJECT.md");
    expect(fs.existsSync(projectMdPath)).toBe(true);
    const projectContent = fs.readFileSync(projectMdPath, "utf-8");
    expect(projectContent).toBe(prompt);
  });

  it("saves codebase and branch records to the database", async () => {
    const prompt = "Database test project description.";
    
    const res = await request(app)
      .post("/api/codebase/setup")
      .send({ 
        name: "test-project", 
        folderName, 
        prompt,
        setup: "test" 
      })
      .expect(200);

    const { codebaseId, branchId } = res.body.data;

    const codebase = await prisma.codebase.findFirst({ where: { path: tempDir } });
    expect(codebase).toBeTruthy();
    expect(codebase?.id).toBe(codebaseId);
    expect(codebase?.name).toBe("test-project");

    const branch = await prisma.branch.findFirst({ where: { id: branchId } });
    expect(branch).toBeTruthy();
    expect(branch?.codebaseId).toBe(codebaseId);
    expect(branch?.name).toBe("master");
    expect(branch?.worktree).toBe(tempDir);
    expect(branch?.ticketId).toBeNull();
  });

  it("doesn't duplicate codebase when it already exists", async () => {
    // Seed an existing codebase
    const existing = await prisma.codebase.create({
      data: { name: "existing-project", path: tempDir },
    });

    const prompt = "Duplicate test project.";

    const res = await request(app)
      .post("/api/codebase/setup")
      .send({ 
        name: "test-project", 
        folderName, 
        prompt,
        setup: "test" 
      })
      .expect(200);

    const { codebaseId } = res.body.data;
    expect(codebaseId).toBe(existing.id);

    const codebases = await prisma.codebase.findMany({ where: { path: tempDir } });
    expect(codebases.length).toBe(1);
    expect(codebases[0]?.name).toBe("existing-project");
  });

  it("doesn't duplicate branch when master already exists", async () => {
    const codebase = await prisma.codebase.create({
      data: { name: "test-project", path: tempDir },
    });
    const existingBranch = await prisma.branch.create({
      data: {
        name: "master",
        codebaseId: codebase.id,
        worktree: tempDir,
        ticketId: null,
      },
    });

    const prompt = "Branch test project.";

    const res = await request(app)
      .post("/api/codebase/setup")
      .send({ 
        name: "test-project", 
        folderName, 
        prompt,
        setup: "test" 
      })
      .expect(200);

    expect(res.body.data.branchId).toBe(existingBranch.id);
    const branches = await prisma.branch.findMany({
      where: { codebaseId: codebase.id, name: "master" },
    });
    expect(branches.length).toBe(1);
  });

  it("does not re-run setup script when project already initialized (idempotent)", async () => {
    const prompt = "Idempotent test project.";

    // First run should execute the script and mark setup=true in DB
    const first = await request(app)
      .post("/api/codebase/setup")
      .send({ 
        name: "test-project", 
        folderName, 
        prompt,
        setup: "test" 
      })
      .expect(200);

    expect(first.body.success).toBe(true);
    expect(first.body.data.stdout).toContain("Project setup completed successfully");

    const codebase1 = await prisma.codebase.findFirst({ where: { path: tempDir } });
    expect(codebase1?.setup).toBe(true);

    // Second run should skip script based on DB flag
    const second = await request(app)
      .post("/api/codebase/setup")
      .send({ 
        name: "test-project", 
        folderName, 
        prompt,
        setup: "test" 
      })
      .expect(200);

    expect(second.body.success).toBe(true);
    expect(second.body.data.stdout).toContain(
      "codebase already set up, skipping initialization"
    );

    const codebase2 = await prisma.codebase.findFirst({ where: { path: tempDir } });
    expect(codebase2?.setup).toBe(true);
  });

  it("returns 500 and does not complete setup when setup script fails", async () => {
    const prompt = "Failing test project.";

    const res = await request(app)
      .post("/api/codebase/setup")
      .send({ 
        name: "test-project", 
        folderName, 
        prompt,
        setup: "failing" 
      })
      .expect(500);

    expect(res.body?.success).toBe(false);
    expect(res.body?.error).toContain("Command failed:");

    // With the new flow, the codebase record may exist but setup must remain false
    const codebase = await prisma.codebase.findFirst({ where: { path: tempDir } });
    expect(codebase).toBeTruthy();
    expect(codebase?.setup).toBe(false);
  });

  it("returns 400 when required fields are missing", async () => {
    const resNoName = await request(app)
      .post("/api/codebase/setup")
      .send({ 
        folderName: "test-folder", 
        prompt: "Test prompt"
      })
      .expect(400);

    expect(resNoName.body?.success).toBe(false);
    expect(resNoName.body?.error).toBe("name and folderName are required");

    const resNoFolder = await request(app)
      .post("/api/codebase/setup")
      .send({ 
        name: "test-project", 
        prompt: "Test prompt"
      })
      .expect(400);

    expect(resNoFolder.body?.success).toBe(false);
    expect(resNoFolder.body?.error).toBe("name and folderName are required");
  });

  it("works without prompt parameter (optional field)", async () => {
    const res = await request(app)
      .post("/api/codebase/setup")
      .send({
        name: "test-project",
        folderName,
        setup: "test",
      })
      .expect(200);

    expect(res.body?.success).toBe(true);

    // Verify PROJECT.md is created but may be empty when no prompt provided
    const projectMdPath = path.join(tempDir, "agent", "PROJECT.md");
    expect(fs.existsSync(projectMdPath)).toBe(true);
  });

  it("creates PROJECT.md with multi-line prompt content", async () => {
    const prompt = `# Test Project

This is a multi-line prompt with:
- Bullet points
- **Bold text**
- Code blocks

## Goals
1. Test functionality
2. Validate content preservation`;

    const res = await request(app)
      .post("/api/codebase/setup")
      .send({
        name: "test-project",
        folderName,
        prompt,
        setup: "test",
      })
      .expect(200);

    expect(res.body?.success).toBe(true);

    const projectMdPath = path.join(tempDir, "agent", "PROJECT.md");
    expect(fs.existsSync(projectMdPath)).toBe(true);
    const projectContent = fs.readFileSync(projectMdPath, "utf-8");
    expect(projectContent).toBe(prompt);
  });

  it("handles empty prompt gracefully", async () => {
    const prompt = "";

    const res = await request(app)
      .post("/api/codebase/setup")
      .send({
        name: "test-project",
        folderName,
        prompt,
        setup: "test",
      })
      .expect(200);

    expect(res.body?.success).toBe(true);

    const projectMdPath = path.join(tempDir, "agent", "PROJECT.md");
    expect(fs.existsSync(projectMdPath)).toBe(true);
    const projectContent = fs.readFileSync(projectMdPath, "utf-8");
    expect(projectContent).toBe("");
  });
});
