import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import prisma from "../client";
import { SetupGitHandler } from "../../src/handlers/setupGitHandler";

describe("SetupGitHandler", () => {
  let tempDir: string;
  let codebaseId: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-setup-git-"));
    const codebase = await prisma.codebase.create({
      data: {
        name: "test-project",
        path: tempDir,
      },
    });
    codebaseId = codebase.id;
  });

  afterEach(async () => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should initialize a git repository", async () => {
    const handler = new SetupGitHandler(tempDir, codebaseId);
    await handler.handle();
    expect(fs.existsSync(path.join(tempDir, ".git"))).toBe(true);
  });

  it("should set the main branch to master", async () => {
    const handler = new SetupGitHandler(tempDir, codebaseId);
    await handler.handle();
    const headContent = fs.readFileSync(path.join(tempDir, ".git", "HEAD"), "utf-8");
    expect(headContent.trim()).toBe("ref: refs/heads/master");
  });

  it("should set the author name to 'Alex Younger Agent'", async () => {
    const handler = new SetupGitHandler(tempDir, codebaseId);
    await handler.handle();
    const authorName = execSync("git config user.name", { cwd: tempDir, encoding: "utf-8" }).trim();
    expect(authorName).toBe("Alex Younger Agent");
  });

  it("should set the author email to a default value", async () => {
    const handler = new SetupGitHandler(tempDir, codebaseId);
    await handler.handle();
    const authorEmail = execSync("git config user.email", { cwd: tempDir, encoding: "utf-8" }).trim();
    expect(authorEmail).toBe("thealexyounger@proton.me");
  });

  it("should create a master branch record in the database", async () => {
    const handler = new SetupGitHandler(tempDir, codebaseId);
    await handler.handle();
    const branch = await prisma.branch.findFirst({
      where: { codebaseId, name: "master" },
    });
    expect(branch).toBeTruthy();
    expect(branch?.worktree).toBe(tempDir);
    expect(branch?.ticketId).toBeNull();
  });
});
