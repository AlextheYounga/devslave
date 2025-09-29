import { Request, Response } from "express";
import { prisma } from "../prisma";
import { PrismaClient } from "@prisma/client";
import { AgentFailed } from "../events";
import AgentProcessHandler from "../handlers/agentProcess.handler";
import { ok } from "assert";

type RequestBody = {
  executionId: string;
  agentId: string;
};

export default class AgentWatchdogController {
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
      const { agentId, executionId } = this.data as RequestBody;

      const agent = await this.db.agent.findUnique({
        where: { id: agentId },
      });

      if (!agentId || !executionId || !agent) {
        return this.res.status(400).json({
          success: false,
          error: "agentId, executionId, and valid agent are required",
        });
      }

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
