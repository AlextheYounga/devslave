import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import prisma from "../client"
import { SetupCodebaseHandler } from "../../src/handlers/setupCodebaseHandler";

describe("SetupCodebaseHandler", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-setup-dev-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should execute default setup script when no params provided", async () => {
    const handler = new SetupCodebaseHandler("test-project", tempDir, {});
    await handler.handle();
    
    // Verify codex folder was created by setup script
    expect(fs.existsSync(path.join(tempDir, "codex"))).toBe(true);
    
    // Verify git was initialized
    expect(fs.existsSync(path.join(tempDir, ".git"))).toBe(true);
  });

  it("should execute custom setup script when params.setup is provided", async () => {
    const handler = new SetupCodebaseHandler("test-project", tempDir, { setup: "default" });
    await handler.handle();
    
    // Verify codex folder was created by setup script
    expect(fs.existsSync(path.join(tempDir, "codex"))).toBe(true);
    
    // Verify git was initialized
    expect(fs.existsSync(path.join(tempDir, ".git"))).toBe(true);
  });

  it("should initialize a git repository", async () => {
    const handler = new SetupCodebaseHandler("test-project", tempDir, {});
    await handler.handle();
    expect(fs.existsSync(path.join(tempDir, ".git"))).toBe(true);
  });

  it("should set the main branch to master", async () => {
    const handler = new SetupCodebaseHandler("test-project", tempDir, {});
    await handler.handle();
    const headContent = fs.readFileSync(path.join(tempDir, ".git", "HEAD"), "utf-8");
    expect(headContent.trim()).toBe("ref: refs/heads/master");
  });

  it("should set the author name to 'Alex Younger Agent'", async () => {
    const handler = new SetupCodebaseHandler("test-project", tempDir, {});
    await handler.handle();
    const authorName = execSync("git config user.name", { cwd: tempDir, encoding: "utf-8" }).trim();
    expect(authorName).toBe("Alex Younger Agent");
  });

  it("should set the author email to a default value", async () => {
    const handler = new SetupCodebaseHandler("test-project", tempDir, {});
    await handler.handle();
    const authorEmail = execSync("git config user.email", { cwd: tempDir, encoding: "utf-8" }).trim();
    expect(authorEmail).toBe("thealexyounger@proton.me");
  });

  it("should save codebase to database", async () => {
    const handler = new SetupCodebaseHandler("test-project", tempDir, {});
    const result = await handler.handle();
    const codebase = await prisma.codebase.findFirst({ where: { path: tempDir } });
    expect(codebase).toBeTruthy();
    expect(codebase?.name).toBe("test-project");
    expect(result.codebaseId).toBe(codebase?.id);
  });

  it("should create a master branch record in the database", async () => {
    const handler = new SetupCodebaseHandler("test-project", tempDir, {});
    const result = await handler.handle();
    const branch = await prisma.branch.findFirst({
      where: { codebaseId: result.codebaseId, name: "master" },
    });
    expect(branch).toBeTruthy();
    expect(branch?.worktree).toBe(tempDir);
    expect(branch?.ticketId).toBeNull();
    expect(result.branchId).toBe(branch?.id);
  });

  it("should not create duplicate codebase if already exists", async () => {
    // First, create a codebase manually
    const existingCodebase = await prisma.codebase.create({
      data: {
        name: "existing-project",
        path: tempDir,
      },
    });
    const handler = new SetupCodebaseHandler("test-project", tempDir, {});
    const result = await handler.handle();
    const codebases = await prisma.codebase.findMany({ where: { path: tempDir } });
    expect(codebases.length).toBe(1);
    expect(codebases[0]!.name).toBe("existing-project"); // Should keep existing name
    expect(result.codebaseId).toBe(existingCodebase.id);
  });

  it("should not create duplicate branch if already exists", async () => {
    // Create codebase and branch manually first
    const codebase = await prisma.codebase.create({
      data: {
        name: "test-project",
        path: tempDir,
      },
    });
    const existingBranch = await prisma.branch.create({
      data: {
        name: "master",
        codebaseId: codebase.id,
        worktree: tempDir,
        ticketId: null,
      },
    });

    const handler = new SetupCodebaseHandler("test-project", tempDir, {});
    const result = await handler.handle();
    
    const branches = await prisma.branch.findMany({ 
      where: { codebaseId: codebase.id, name: "master" } 
    });
    expect(branches.length).toBe(1);
    expect(result.branchId).toBe(existingBranch.id);
  });

  it("should return both codebaseId and branchId after handling", async () => {
    const handler = new SetupCodebaseHandler("test-project", tempDir, {});
    const result = await handler.handle();
    expect(result).toBeDefined();
    expect(result.codebaseId).toBeDefined();
    expect(result.branchId).toBeDefined();
    expect(typeof result.codebaseId).toBe("string"); // CUID is a string
    expect(typeof result.branchId).toBe("string"); // CUID is a string
  });
});
