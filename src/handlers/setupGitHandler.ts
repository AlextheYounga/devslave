import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import { prisma } from "../prisma";

export class SetupGitHandler {
  private db: PrismaClient;
  public projectPath: string;
  public codebaseId: string;

  constructor(projectPath: string, codebaseId: string) {
    this.db = prisma;
    this.projectPath = projectPath;
    this.codebaseId = codebaseId;
  }

  async handle() {
    execSync("git init", { cwd: this.projectPath });
    execSync("git branch -m master", { cwd: this.projectPath });
    execSync('git config user.name "Alex Younger Agent"', { cwd: this.projectPath });
    execSync('git config user.email "thealexyounger@proton.me"', { cwd: this.projectPath });
    await this.createMasterBranch();
  }

  private async createMasterBranch() {
    await this.db.branch.create({
      data: {
        name: "master",
        codebaseId: this.codebaseId,
        worktree: this.projectPath,
        ticketId: null,
      },
    });
  }
}
