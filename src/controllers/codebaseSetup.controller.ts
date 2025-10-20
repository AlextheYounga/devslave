import { Request, Response } from "express";
import { paths, AGENT_FOLDER } from "../constants";
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

      if (!name || !folderName || !prompt) {
        return this.res.status(400).json({
          success: false,
          error: "name, folderName, and prompt are required",
        });
      }

      new CodebaseSetupStarted(this.data).publish();
      const projectPath = path.join(paths.devWorkspace, folderName);
      
      // Save codebase to DB first so setup script can find it
      const codebase = await this.saveCodebase(projectPath, prompt);

      // Idempotency: use DB flag to determine if setup already completed
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

      // Setup script handles PROJECT.md creation and all setup logic
      const scriptOutput = await this.runSetupScript(codebase.id);

      // Update codebase to mark setup as completed
      await this.db.codebase.update({
        where: { id: codebase.id },
        data: { setup: true },
      });

      this.data = {
        ...this.data,
        codebaseId: codebase.id,
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

  private async runSetupScript(codebaseId: string) {
    const scriptFile = `${paths.scripts}/setup.sh`;

    // Execute via bash for portability and proper error codes; quote args
    const scriptOutput = execSync(`bash "${scriptFile}" "${codebaseId}"`, {
      stdio: "pipe",
      encoding: "utf-8",
      env: { ...process.env }, // Pass current environment to script
    });
    return scriptOutput;
  }

  private async saveCodebase(projectPath: string, prompt: string) {
    const existing = await this.db.codebase.findFirst({
      where: { path: projectPath },
    });
    if (existing) return existing;
    return await this.db.codebase.create({
      data: {
        name: this.data.name,
        path: projectPath,
        data: {
          masterPrompt: prompt,
          setupType: this.data.setup || "default",
        },
      },
    });
  }
}
