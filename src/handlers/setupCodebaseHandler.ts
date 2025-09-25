import { PrismaClient } from "@prisma/client";
import { prisma } from "../prisma";
import { execSync } from "child_process";
import path from "path";

export class SetupCodebaseHandler {
  private db: PrismaClient;
  public projectPath: string;
  public name: string;

  constructor(name: string, projectPath: string) {
    this.db = prisma;
    this.name = name;
    this.projectPath = projectPath;
  }

  async handle() {
    const scriptFile = path.resolve(__dirname, "../scripts/setup-blank.sh");
    execSync(scriptFile, { cwd: this.projectPath });
    
    const codebaseId = await this.saveCodebase();
    const branchRecord = await this.createMasterBranch(codebaseId);
  }

  async saveCodebase() {
    // Check if codebase already exists
    const existing = await prisma.codebase.findFirst({
      where: { path: this.projectPath },
    });
    if (existing) return existing.id;

    const codebase = await prisma.codebase.create({
      data: {
        name: this.name,
        path: this.projectPath,
      },
    });

    return codebase.id;
  }

  async createMasterBranch(codebaseId: string) {
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
