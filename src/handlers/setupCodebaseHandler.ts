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
    let setupScript: string = this.params?.setup ?? 'default';
    const scriptFile = path.resolve(__dirname, `../scripts/setup/setup-${setupScript}.sh`);
    execSync(`${scriptFile} ${this.projectPath}`);
    
    const codebaseRecord = await this.saveCodebase();
    const branchRecord = await this.createMasterBranch(codebaseRecord.id);

    return {
      codebaseId: codebaseRecord.id,
      branchId: branchRecord.id,
    }
  }

  async saveCodebase() {
    // Check if codebase already exists
    const existing = await prisma.codebase.findFirst({
      where: { path: this.projectPath },
    });

    if (existing) return existing;

    return await prisma.codebase.create({
      data: {
        name: this.name,
        path: this.projectPath,
      },
    });
  }

  async createMasterBranch(codebaseId: string) {
    // Check if branch already exists
    const existing = await prisma.branch.findFirst({
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
