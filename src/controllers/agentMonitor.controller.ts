import { Request, Response } from "express";
import { prisma } from "../prisma";
import { PrismaClient } from "@prisma/client";
import { AgentFailed } from "../events";
import AgentMonitorHandler from "../handlers/agentMonitor.handler";

export default class AgentMonitorController {
  private db: PrismaClient;
  private req: Request;
  private res: Response;
  private data: any;

  constructor(req: Request, res: Response) {
    this.db = prisma;
    this.req = req;
    this.res = res;
    this.data = {};
  }

  async handleRequest() {
    try {
      // Get agentId from request url
      const agentId = this.req.params.id!;

      const agent = await this.db.agent.findUniqueOrThrow({
        where: { id: agentId },
      });

      // Watch the agent until completion - this keeps the HTTP connection open
      const agentMonitor = new AgentMonitorHandler(agent);
      const agentStatus = await agentMonitor.watch();

      const currentAgent = await this.db.agent.findUnique({
        where: { id: agentId },
      });

      if (!currentAgent) {
        return this.res.status(500).json({
          success: false,
          error: "Agent disappeared from database",
        });
      }

      // Return final completion status
      return this.res.status(200).json({
        success: true,
        message: `Agent completed with status: ${currentAgent.status}`,
        data: {
          ...this.data,
          ...agentStatus.data,
        },
      });
    } catch (error: any) {
      console.error("Error in AgentMonitorController:", error);
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
