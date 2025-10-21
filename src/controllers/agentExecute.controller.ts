import { Request, Response } from "express";
import { prisma } from "../prisma";
import { PrismaClient } from "@prisma/client";
import { AgentFailed } from "../events";
import type { Role } from "../constants";
import AgentLaunchHandler from "../handlers/agentLaunch.handler";
import AgentMonitorHandler from "../handlers/agentMonitor.handler";

type RequestBody = {
  executionId: string;
  codebaseId: string;
  prompt: string;
  role: Role;
};

export default class AgentExecuteController {
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

      const codebase = await this.db.codebase.findUniqueOrThrow({
        where: { id: codebaseId },
      });

      if (!prompt || !codebaseId || !codebase || !executionId || !role) {
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

      // Launch the agent process
      const agentLaunchInfo = await agentHandler.launch();

      const agent = await this.db.agent.findUniqueOrThrow({
        where: { id: agentLaunchInfo.agentId },
      });

      // Watch the agent until completion - this keeps the HTTP connection open
      const agentMonitor = new AgentMonitorHandler(agent);
      const agentStatus = await agentMonitor.watch();
      
      this.data = { ...this.data, ...agentLaunchInfo, ...agentStatus };

      return this.res.status(200).json({
        success: true,
        message: "Agent completed",
        data: this.data,
      });
    } catch (error: any) {
      console.error("Error in AgentExecuteController:", error);
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
