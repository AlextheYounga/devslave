import { prisma } from "../prisma";
import { promises as fs } from "fs";
import { PrismaClient, Agent, AgentStatus } from "@prisma/client";
import { SENTINEL } from "../constants";
import { AgentRunning, AgentCompleted, AgentFailed } from "../events";

export default class AgentWatchdogHandler {
  private db: PrismaClient;
  public executionId: string;
  public agent: Agent;
  public status: AgentStatus = AgentStatus.LAUNCHED;
  private lastPublishedStatus: AgentStatus | null = null;

  constructor(executionId: string, agent: Agent) {
    this.db = prisma;
    this.executionId = executionId;
    this.agent = agent;
  }

  async ping() {
    let sessionContext: string | null = null;
    let nextStatus: AgentStatus = this.status;

    try {
      sessionContext = await this.readSessionLog();
      nextStatus = sessionContext.includes(SENTINEL)
        ? AgentStatus.COMPLETED
        : AgentStatus.RUNNING;
    } catch (error) {
      console.error("Error reading session log file:", error);
      nextStatus = AgentStatus.FAILED;
    }

    // Publish event only on transition
    if (this.lastPublishedStatus !== nextStatus) {
      this.lastPublishedStatus = nextStatus;
      switch (nextStatus) {
        case AgentStatus.RUNNING:
          new AgentRunning({
            agentId: this.agent.id,
            executionId: this.executionId,
          }).publish();
          break;
        case AgentStatus.COMPLETED:
          new AgentCompleted({
            agentId: this.agent.id,
            executionId: this.executionId,
          }).publish();
          break;
        case AgentStatus.FAILED:
          new AgentFailed({
            agentId: this.agent.id,
            executionId: this.executionId,
          }).publish();
          break;
      }
    }

    this.status = nextStatus;
    return await this.updateAgentRecord(sessionContext);
  }

  private async readSessionLog() {
    const logFile = this.agent.logFile;
    if (!logFile) {
      throw new Error("Agent log file not found");
    }
    await fs.access(logFile);
    const sessionContext = await fs.readFile(logFile, "utf-8");
    return sessionContext;
  }

  private async updateAgentRecord(context: string | null) {
    const parsedContext = this.readJsonl(context);
    return await this.db.agent.update({
      where: { id: this.agent.id },
      data: {
        status: this.status,
        context: parsedContext ?? undefined,
      },
    });
  }

  readJsonl(context: string | null): Record<string, any>[] {
    if (!context) return [];
    const lines = context.split(/\r?\n/).filter(Boolean);
    const entries: Record<string, any>[] = [];
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line));
      } catch {
        // Skip malformed/partial JSONL lines
      }
    }
    return entries;
  }
}
