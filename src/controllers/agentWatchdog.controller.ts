import { Request, Response } from "express";
import { prisma } from "../prisma";
import { PrismaClient } from "@prisma/client";
import { AgentFailed } from "../events";
import AgentWatchdogHandler from "../handlers/agentWatchdog.handler";

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

      // Validate inputs before DB lookup
      if (!agentId || !executionId) {
        return this.res.status(400).json({
          success: false,
          error: "agentId and executionId are required",
        });
      }

      const agent = await this.db.agent.findUnique({
        where: { id: agentId },
      });

      if (!agent) {
        return this.res.status(400).json({
          success: false,
          error: "Valid agent is required",
        });
      }

      const watchdogHandler = new AgentWatchdogHandler(this.data.executionId, agent);

      const agentStatus = await watchdogHandler.ping();
      const currentAgent = await this.db.agent.findUnique({
        where: { id: agentId },
      });

      if (!currentAgent) {
        return this.res.status(500).json({
          success: false,
          error: "Agent disappeared from database",
        });
      }

      // Fire-and-forget: do not await watchdog completion; respond immediately
      return this.res.status(202).json({
        success: true,
        message: `Agent status: ${currentAgent.status}`,
        data: {
          ...this.data,
          ...agentStatus.data,
        },
      });
    } catch (error: any) {
      console.error("Error in AgentWatchdogController:", error);
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
