import { Request, Response } from "express";
import { REPO_ROOT } from "../constants";
import { execSync } from "child_process";
import { prisma } from "../prisma";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import {
  CodebaseSetupStarted,
  CodebaseSetupCompleted,
  CodebaseSetupFailed,
} from "../events";

dotenv.config();

type RequestBody = {
  executionId: string;
  name: string;
  projectPath: string;
  setup?: string;
};

export default class CodebaseSetupController {
  private db: PrismaClient;
  private req: Request;
  private res: Response;
  private data: any;

  constructor(req: Request, res: Response) {
    this.db = prisma;
    this.req = req;
    this.res = res;
    this.data = this.req.body;
  }

  async handleRequest() {
    try {
      const { name, projectPath } = this.data as RequestBody;

      if (!name || !projectPath) {
        return this.res.status(400).json({
          success: false,
          error: "name and projectPath are required",
        });
      }

      new CodebaseSetupStarted(this.data).publish();

      // Run the setup script
      const scriptOutput = await this.runSetupScript(projectPath);
      const codebaseRecord = await this.saveCodebase(name, projectPath);
      const branchRecord = await this.createMasterBranch(codebaseRecord.id, projectPath);

      this.data = {
        ...this.data,
        codebaseId: codebaseRecord.id,
        branchId: branchRecord.id,
        stdout: scriptOutput,
      };

      new CodebaseSetupCompleted(this.data).publish();

      return this.res.status(200).json({
        success: true,
        data: {
          codebaseId: codebaseRecord.id,
          branchId: branchRecord.id,
          stdout: scriptOutput,
        },
      });
    } catch (error: any) {
      console.error("Error in CodebaseSetupController:", error);
      new CodebaseSetupFailed({
        ...this.data,
        error: error?.message ?? String(error),
      }).publish();

      return this.res.status(500).json({
        success: false,
        error: error?.message ?? String(error),
      });
    }
  }

  private async runSetupScript(projectPath: string) {
    const { setup = "default" } = this.data as RequestBody;
    const scriptFolder = process.env.SCRIPT_PATH || "src/scripts";
    const scriptFile = `${REPO_ROOT}/${scriptFolder}/setup/setup-${setup}.sh`;

    // Execute via bash for portability and proper error codes; quote args
    const scriptOutput = execSync(`bash "${scriptFile}" "${projectPath}"`, {
      stdio: "pipe",
      encoding: "utf-8",
    });
    return scriptOutput;
  }

  private async saveCodebase(name: string, projectPath: string) {
    const existing = await this.db.codebase.findFirst({
      where: { path: projectPath },
    });

    if (existing) return existing;

    return await this.db.codebase.create({
      data: {
        name,
        path: projectPath,
      },
    });
  }

  private async createMasterBranch(codebaseId: string, projectPath: string) {
    const existing = await this.db.branch.findFirst({
      where: { codebaseId: codebaseId, name: "master" },
    });

    if (existing) return existing;

    return await this.db.branch.create({
      data: {
        name: "master",
        codebaseId: codebaseId,
        worktree: projectPath,
        ticketId: null,
      },
    });
  }
}
