import { Request, Response } from "express";
import { paths } from "../constants";
import { execSync } from "child_process";
import { prisma } from "../prisma";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

type RequestBody = {
  codebaseId: string;
  message?: string; // for commit
  name?: string; // for create-branch
  [key: string]: any;
};

export default class GitController {
  private db: PrismaClient;
  private req: Request;
  private res: Response;
  private data: any;

  constructor() {
    this.db = prisma;
    this.req = {} as Request;
    this.res = {} as Response;
    this.data = {};
  }

  async handleRequest(req: Request, res: Response) {
    this.req = req;
    this.res = res;
    this.data = this.req.body as RequestBody;

    try {
      // Determine command from URL path
      const command = this.getCommandFromPath(req.path);

      if (command === "commit") {
        const codebaseId = this.data.codebaseId;
        const message = this.data.message;
        const output = await this.commit(codebaseId, message);
        return this.res.status(200).json({
          success: true,
          data: {
            ...this.data,
            stdout: output,
          },
        });
      }

      if (command === "create-branch") {
        const codebaseId = this.data.codebaseId;
        const branchName = this.data.name;
        const output = await this.createBranch(codebaseId, branchName);
        return this.res.status(200).json({
          success: true,
          data: {
            ...this.data,
            stdout: output,
          },
        });
      }

      throw new Error(`Unknown command: ${command}`);
    } catch (error: any) {
      console.error("Error in GitController:", error);

      return this.res.status(500).json({
        success: false,
        error: error?.message ?? String(error),
      });
    }
  }

  private getCommandFromPath(path: string): string {
    if (path.includes("/commit")) {
      return "commit";
    }
    if (path.includes("/create-branch")) {
      return "create-branch";
    }
    throw new Error(`Unable to determine command from path: ${path}`);
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
