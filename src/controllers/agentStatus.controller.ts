import { Request, Response } from "express";
import { prisma } from "../prisma";
import { PrismaClient } from "@prisma/client";
import { AgentFailed } from "../events";
import AgentStatusHandler from "../handlers/agentStatus.handler";

export default class AgentStatusController {
  private db: PrismaClient;
  private req: Request;
  private res: Response;
  private data: any;

  constructor(req: Request, res: Response) {
    this.db = prisma;
    this.req = req;
    this.res = res;
    this.data = { agentId: req.params.id! };
  }

  async handleRequest() {
    try {
      const agentId = this.req.params.id!;
      const agent = await this.db.agent.findUnique({
        where: { id: agentId },
      });

      if (!agent) {
        return this.res.status(400).json({
          success: false,
          error: "Valid agent is required",
        });
      }

      const statusHandler = new AgentStatusHandler(agent);
      const agentStatus = await statusHandler.ping();
      const currentAgent = await this.db.agent.findUniqueOrThrow({
        where: { id: agentId },
      });

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
      console.error("Error in AgentStatusController:", error);
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
