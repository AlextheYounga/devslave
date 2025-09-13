import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import prisma from "../client"
import { SetupDevFolderHandler } from "../../src/handlers/setupDevFolderHandler";

describe("SetupDevFolderHandler", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-setup-dev-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("should create .dev folder if it does not exist", () => {
    const handler = new SetupDevFolderHandler("test-project", tempDir);
    handler.createDevFolder();
    expect(fs.existsSync(path.join(tempDir, ".dev"))).toBe(true);
  });

  it("should create .gitignore if it does not exist", () => {
    const handler = new SetupDevFolderHandler("test-project", tempDir);
    handler.handleGitignore();
    expect(fs.existsSync(path.join(tempDir, ".gitignore"))).toBe(true);
  });

  it("should add .dev to .gitignore if not present", () => {
    const gitignorePath = path.join(tempDir, ".gitignore");
    fs.writeFileSync(gitignorePath, "node_modules\n");
    const handler = new SetupDevFolderHandler("test-project", tempDir);
    handler.handleGitignore();
    const content = fs.readFileSync(gitignorePath, "utf-8");
    expect(content).toContain(".dev");
  });

  it("should not duplicate .dev in .gitignore if already present", () => {
    const gitignorePath = path.join(tempDir, ".gitignore");
    fs.writeFileSync(gitignorePath, "node_modules\n.dev\n");
    const handler = new SetupDevFolderHandler("test-project", tempDir);
    handler.handleGitignore();
    const content = fs.readFileSync(gitignorePath, "utf-8");
    const lines = content.split("\n");
    expect(lines.filter((line) => line === ".dev").length).toBe(1);
  });

  it("should save codebase to database", async () => {
    const handler = new SetupDevFolderHandler("test-project", tempDir);
    await handler.handle();
    const codebase = await prisma.codebase.findFirst({ where: { path: tempDir } });
    expect(codebase).toBeTruthy();
    expect(codebase?.name).toBe("test-project");
  });

  it("should not create duplicate codebase if already exists", async () => {
    // First, create a codebase manually
    await prisma.codebase.create({
      data: {
        name: "existing-project",
        path: tempDir,
      },
    });
    const handler = new SetupDevFolderHandler("test-project", tempDir);
    await handler.handle();
    const codebases = await prisma.codebase.findMany({ where: { path: tempDir } });
    expect(codebases.length).toBe(1);
    expect(codebases[0]!.name).toBe("existing-project"); // Assuming we don't update if exists
  });
});
