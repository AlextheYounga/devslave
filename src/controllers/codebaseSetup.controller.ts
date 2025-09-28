import { Request, Response } from "express";
import { execSync } from "child_process";
import path from "path";
import { prisma } from "../prisma";
import {
  CodebaseSetupStarted,
  CodebaseSetupCompleted,
  CodebaseSetupFailed,
} from "../events";
import { PrismaClient } from "@prisma/client";

type SetupBody = {
  name: string;
  projectPath: string;
  params?: any;
};

export default class CodebaseSetupController {
  private db: PrismaClient;
  private req: Request;
  private res: Response;
  private eventData: any;

  constructor(req: Request, res: Response) {
    this.db = prisma;
    this.req = req;
    this.res = res;
    this.eventData = {};
  }

  async handleRequest() {
    try {
      const { name, projectPath, params } = this.req.body as SetupBody;
      this.eventData = { name, projectPath, params };

      if (!name || !projectPath) {
        return this.res.status(400).json({
          success: false,
          error: "name and projectPath are required",
        });
      }

      new CodebaseSetupStarted(this.eventData).publish();

      const setupScript: string = params?.setup ?? "default";
      const scriptFile =
        params?.scriptPath ??
        path.resolve(__dirname, `../scripts/setup/setup-${setupScript}.sh`);

      // Execute via bash for portability and proper error codes; quote args
      const scriptOutput = execSync(`bash "${scriptFile}" "${projectPath}"`, {
        stdio: "pipe",
        encoding: "utf-8",
      });

      const codebaseRecord = await this.saveCodebase(name, projectPath);
      const branchRecord = await this.createMasterBranch(
        codebaseRecord.id,
        projectPath
      );

      this.eventData = {
        ...this.eventData,
        codebaseId: codebaseRecord.id,
        branchId: branchRecord.id,
        stdout: scriptOutput,
      };

      new CodebaseSetupCompleted(this.eventData).publish();

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
        ...this.eventData,
        error: error?.message ?? String(error),
      }).publish();

      return this.res.status(500).json({
        success: false,
        error: error?.message ?? String(error),
      });
    }
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
