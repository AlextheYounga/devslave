import { Request, Response } from "express";
import { REPO_ROOT } from "../constants";
import { exec } from "child_process";
import { prisma } from "../prisma";
import { PrismaClient, Codebase } from "@prisma/client";
import dotenv from "dotenv";
import { AgentRunCompleted, AgentRunFailed, AgentRunStarted } from "../events";

dotenv.config();

type RequestBody = {
  executionId: string;
  codebaseId: string;
  prompt: string;
  role?: string;
};

class PlanningAgentWatchdog {
  public running: boolean;
  private codebase: Codebase;

  constructor(codebase: Codebase) {
    this.codebase = codebase;
    this.running = true;
  }

  watch() {
    while (this.running) {
      // Monitor the agent's progress, e.g., check logs or status files
      console.log(`Monitoring agent for codebase at ${this.codebase.path}`);

      // await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

export default class PlanningAgentController {
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
      const { prompt, codebaseId } = this.data as RequestBody;

      const codebase = await this.db.codebase.findUnique({
        where: { id: codebaseId },
      });

      if (!prompt || !codebaseId || !codebase) {
        return this.res.status(400).json({
          success: false,
          error: "prompt and valid codebaseId are required",
        });
      }

      new AgentRunStarted(this.data).publish();

      this.runAgentAsync(codebase.path, prompt);

      new AgentRunCompleted(this.data).publish();

      return this.res.status(200).json({
        success: true,
        data: this.data,
      });
    } catch (error: any) {
      console.error("Error in CodebaseSetupController:", error);
      new AgentRunFailed({
        ...this.data,
        error: error?.message ?? String(error),
      }).publish();

      return this.res.status(500).json({
        success: false,
        error: error?.message ?? String(error),
      });
    }
  }

  private async runAgentAsync(projectPath: string, prompt: string) {
    const scriptFolder = process.env.SCRIPT_PATH || "src/scripts";
    const scriptFile = `${REPO_ROOT}/${scriptFolder}/launch-agent.sh`;
    exec(`bash ${scriptFile} ${projectPath} ${prompt}`);
  }
}
