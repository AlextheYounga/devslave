import { paths } from "../constants";
import { execSync } from "child_process";
import { prisma } from "../prisma";
import { PrismaClient } from "@prisma/client";

export default class GitHandler {
  private db: PrismaClient;

  constructor() {
    this.db = prisma;
  }

  async commit(codebaseId: string, message: string = "Automated commit") {
    const codebase = await this.db.codebase.findUniqueOrThrow({
      where: { id: codebaseId },
    });
    const scriptPath = `${paths.scripts}/git_commit.sh`;
    const output = execSync(`bash "${scriptPath}" "${codebase?.path}" "${message}"`);
    return output.toString();
  }

  async createBranch(codebaseId: string, branchName: string) {
    const codebase = await this.db.codebase.findUniqueOrThrow({
      where: { id: codebaseId },
    });
    const scriptPath = `${paths.scripts}/git_branch.sh`;
    const output = execSync(`bash "${scriptPath}" "${codebase?.path}" "${branchName}"`);
    return output.toString();
  }
}
