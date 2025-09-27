import { PrismaClient } from "@prisma/client";
import { prisma } from "../prisma";
import { execSync } from "child_process";
import path from "path";

export class SetupCodebaseHandler {
  private db: PrismaClient;
  public projectPath: string;
  public name: string;
  public params: any;

  constructor(name: string, projectPath: string, params: any) {
    this.db = prisma;
    this.name = name;
    this.params = params;
    this.projectPath = projectPath;
  }

  async handle() {
    let setupScript: string = this.params?.setup ?? "default";
    const scriptFile =
      this.params?.scriptPath ??
      path.resolve(__dirname, `../scripts/setup/setup-${setupScript}.sh`);

    // Execute via bash for portability and proper error codes; quote the project path
    const scriptOutput = execSync(
      `bash "${scriptFile}" "${this.projectPath}"`,
      {
        stdio: "pipe", // Capture output instead of inheriting
        encoding: "utf-8",
      }
    );

    const codebaseRecord = await this.saveCodebase();
    const branchRecord = await this.createMasterBranch(codebaseRecord.id);

    return {
      codebaseId: codebaseRecord.id,
      branchId: branchRecord.id,
      stdout: scriptOutput.trim(),
    };
  }

  async saveCodebase() {
    // Check if codebase already exists
    const existing = await this.db.codebase.findFirst({
      where: { path: this.projectPath },
    });

    if (existing) return existing;

    return await this.db.codebase.create({
      data: {
        name: this.name,
        path: this.projectPath,
      },
    });
  }

  async createMasterBranch(codebaseId: string) {
    // Check if branch already exists
    const existing = await this.db.branch.findFirst({
      where: { codebaseId: codebaseId, name: "master" },
    });

    if (existing) return existing;

    return await this.db.branch.create({
      data: {
        name: "master",
        codebaseId: codebaseId,
        worktree: this.projectPath,
        ticketId: null,
      },
    });
  }
}
