import { Request, Response } from "express";
import { prisma } from "../prisma";
import { PrismaClient } from "@prisma/client";
import { AgentFailed } from "../events";
import type { Role } from "../constants";
import AgentLaunchHandler from "../handlers/agentLaunch.handler";

type RequestBody = {
  executionId: string;
  codebaseId: string;
  prompt: string;
  role: Role;
};

export default class AgentLaunchController {
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
      const { prompt, codebaseId, executionId, role } = this.data as RequestBody;

      if (!prompt || !codebaseId || !executionId || !role) {
        return this.res.status(400).json({
          success: false,
          error: "prompt, valid codebaseId, role, and executionId are required",
        });
      }

      const codebase = await this.db.codebase.findUnique({
        where: { id: codebaseId },
      });

      if (!codebase) {
        return this.res.status(400).json({
          success: false,
          error: "prompt, valid codebaseId, role, and executionId are required",
        });
      }

      const agentParams = { prompt, role };
      const agentHandler = new AgentLaunchHandler(
        this.data.executionId, 
        codebase, 
        agentParams
      );

      const agentLaunchInfo = await agentHandler.launch();
      this.data = { ...this.data, ...agentLaunchInfo };

      // Fire-and-forget: do not await watchdog completion; respond immediately
      return this.res.status(202).json({
        success: true,
        message: "Agent started",
        data: this.data,
      });
    } catch (error: any) {
      console.error("Error in AgentLaunchController:", error);
      new AgentFailed({
        ...this.data,
        error: error?.message ?? String(error),
      }).publish();

      return this.res.status(500).json({
        success: false,
        error: error?.message ?? String(error),
      });
    }
  }
}
