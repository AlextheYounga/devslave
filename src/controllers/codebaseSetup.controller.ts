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

  constructor(req: Request, res: Response) {
    this.db = prisma;
    this.req = req;
    this.res = res;
  }

  async handleRequest() {
    try {
      const { name, projectPath, params } = this.req.body as SetupBody;

      if (!name || !projectPath) {
        return this.res.status(400).json({
          success: false,
          error: "name and projectPath are required",
        });
      }

      new CodebaseSetupStarted({ name, projectPath, params }).publish();

      try {
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

        new CodebaseSetupCompleted({
          name,
          projectPath,
          params,
          codebaseId: codebaseRecord.id,
          branchId: branchRecord.id,
          stdout: scriptOutput,
        }).publish();

        return this.res.status(200).json({
          success: true,
          data: {
            codebaseId: codebaseRecord.id,
            branchId: branchRecord.id,
            stdout: scriptOutput,
          },
        });
      } catch (err: any) {
        new CodebaseSetupFailed({
          name,
          projectPath,
          params,
          error: err?.message ?? String(err),
        }).publish();
        return this.res.status(500).json({
          success: false,
          error: "Setup failed",
          details: err?.message ?? String(err),
        });
      }
    } catch (error) {
      console.error("Error in CodebaseSetupController:", error);
      return this.res
        .status(500)
        .json({ success: false, error: "Internal Server Error" });
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
