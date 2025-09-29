import { prisma } from "../prisma";
import { promises, statSync } from "fs";
import { PrismaClient, Agent, AgentStatus } from "@prisma/client";
import { SENTINEL } from "../constants";
import { AgentRunning, AgentCompleted, AgentFailed } from "../events";

export default class AgentWatchdogHandler {
  private db: PrismaClient;
  public executionId: string;
  public agent: Agent;
  public status: AgentStatus = AgentStatus.LAUNCHED;
  private lastPublishedStatus: AgentStatus | null = null;
  private maxIdleTime = 10 * 60 * 1000; // 10 minutes

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

      // Check for idleness
      const { idle, lastModified, timeIdle } = this.checkSessionIdleness();
      if (idle && this.status === AgentStatus.RUNNING) {
        const displaySeconds = Math.floor(timeIdle / 1000);
        console.log(
          `Agent ${this.agent.id} idling since ${lastModified} (${displaySeconds} seconds). Marking as COMPLETED.`
        );
        nextStatus = AgentStatus.COMPLETED;
      }
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
    await promises.access(logFile);
    const sessionContext = await promises.readFile(logFile, "utf-8");
    return sessionContext;
  }

  private checkSessionIdleness() {
    const stats = statSync("path/to/your/file.txt");
    const lastModified = stats.mtime; // This is a Date object
    const now = new Date();
    const timeIdle = now.getTime() - lastModified.getTime();
    if (now.getTime() - lastModified.getTime() > this.maxIdleTime) {
      return { idle: true, lastModified, timeIdle };
    }
    return { idle: false, lastModified, timeIdle };
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

  private readJsonl(context: string | null): Record<string, any>[] {
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
