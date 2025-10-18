import { Request, Response } from "express";
import { REPO_ROOT, AGENT_FOLDER, DEV_WORKSPACE } from "../constants";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { prisma } from "../prisma";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import {
  CodebaseSetupStarted,
  CodebaseSetupCompleted,
  CodebaseSetupFailed,
  CodebaseAlreadySetup,
} from "../events";

dotenv.config();

type RequestBody = {
  executionId: string;
  name: string;
  folderName: string;
  prompt: string;
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
      const { name, folderName, prompt } = this.data as RequestBody;

      if (!name || !folderName) {
        return this.res.status(400).json({
          success: false,
          error: "name and folderName are required",
        });
      }

      new CodebaseSetupStarted(this.data).publish();
      const projectPath = path.join(DEV_WORKSPACE, folderName);

      // Idempotency: use DB flag to determine if setup already completed
      const codebase = await this.saveCodebase(name, projectPath);
      if (codebase.setup && fs.existsSync(projectPath)) {
        new CodebaseAlreadySetup(this.data).publish();
        return this.res.status(200).json({
          success: true,
          data: {
            ...this.data,
            codebaseId: codebase.id,
            stdout: "codebase already set up, skipping initialization",
          },
        });
      }

      // Create PROJECT.md file from prompt
      fs.mkdirSync(`${projectPath}/${AGENT_FOLDER}`, { recursive: true });
      const projectMdPath = path.join(projectPath, `/${AGENT_FOLDER}/PROJECT.md`);
      fs.writeFileSync(projectMdPath, prompt || "", { encoding: "utf-8" });

      const scriptOutput = await this.runSetupScript(projectPath);
      const branch = await this.createMasterBranch(codebase.id, projectPath);

      // Update codebase to mark setup as completed
      await this.db.codebase.update({
        where: { id: codebase.id },
        data: { setup: true },
      });

      this.data = {
        ...this.data,
        codebaseId: codebase.id,
        branchId: branch.id,
        stdout: scriptOutput,
      };

      new CodebaseSetupCompleted(this.data).publish();

      return this.res.status(200).json({
        success: true,
        data: {
          ...this.data,
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
    const existing = await this.db.codebase.findFirst({ where: { path: projectPath } });
    if (existing) return existing;
    return await this.db.codebase.create({ data: { name, path: projectPath } });
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
