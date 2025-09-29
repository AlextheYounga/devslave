import { prisma } from "../prisma";
import { promises as fs } from "fs";
import { exec, execSync } from "child_process";
import { PrismaClient, Agent, AgentStatus } from "@prisma/client";
import { SENTINEL } from "../constants";
import { AgentRunning, AgentCompleted, AgentFailed } from "../events";

export default class AgentWatchdogHandler {
  private db: PrismaClient;
  public executionId: string;
  public agent: Agent;
  public status: AgentStatus = AgentStatus.LAUNCHED;
  private maxIdleTime = 6 * 60 * 1000; // 6 minutes
  private eventData: any;

  constructor(executionId: string, agent: Agent) {
    this.db = prisma;
    this.executionId = executionId;
    this.agent = agent;
    this.status = agent.status as AgentStatus;
    this.eventData = { executionId, agentId: agent.id };
  }

  async ping(): Promise<AgentRunning | AgentCompleted | AgentFailed> {
    const prevStatus = this.status;
    let nextStatus: AgentStatus = this.status;
    let sessionContext: string | null = null;

    try {
      sessionContext = await this.readSessionLog();
      nextStatus = sessionContext.includes(SENTINEL)
        ? AgentStatus.COMPLETED
        : AgentStatus.RUNNING;

      // Check for idleness
      const { idle, lastModified, timeIdle } = await this.checkSessionIdleness();
      if (idle && nextStatus !== AgentStatus.COMPLETED) {
        const displaySeconds = Math.floor(timeIdle / 1000);
        console.log(
          `Agent ${this.agent.id} idling for ${displaySeconds} seconds. Marking as COMPLETED.`
        );
        nextStatus = AgentStatus.COMPLETED;
      }

      this.eventData = {
        ...this.eventData,
        lastModified,
        timeIdle,
        idle,
      };
    } catch (error) {
      console.error("Error reading session log file:", error);
      nextStatus = AgentStatus.FAILED;
    }

    // Persist current status and context for this single agent observation
    this.status = nextStatus;
    await this.updateAgentRecord(sessionContext);

    // Always include status context in the event payload
    this.eventData = {
      ...this.eventData,
      status: nextStatus,
      previousStatus: prevStatus ?? null,
    };

    // Build the event for the current status
    let publishableEvent = new AgentRunning(this.eventData);
    switch (nextStatus) {
      case AgentStatus.RUNNING:
        publishableEvent = new AgentRunning(this.eventData);
        break;
      case AgentStatus.COMPLETED:
        publishableEvent = new AgentCompleted(this.eventData);
        this.killAgent();
        break;
      case AgentStatus.FAILED:
        this.killAgent();
        publishableEvent = new AgentFailed(this.eventData);
        break;
    }

    // Publish event only on transition
    if (prevStatus !== nextStatus) {
      publishableEvent.publish();
    }
    return publishableEvent;
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

  private async checkSessionIdleness() {
    const logFile = this.agent.logFile;
    try {
      if (!logFile) throw new Error("Agent log file not found");
      const stats = await fs.stat(logFile);
      const lastModified = stats.mtime;
      const now = new Date();
      const timeIdle = now.getTime() - lastModified.getTime();
      if (timeIdle > this.maxIdleTime) {
        return { idle: true, lastModified, timeIdle };
      }
      return { idle: false, lastModified, timeIdle };
    } catch {
      // If we cannot stat the file (rotation/transient), treat as not idle
      const lastModified = new Date(0);
      return { idle: false, lastModified, timeIdle: 0 };
    }
  }

  private async updateAgentRecord(context: string | null): Promise<void> {
    const parsedContext = this.readJsonl(context);
    await this.db.agent.update({
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

  private killAgent() {
    if (this.agent.pid) {
      try {
        exec(`tmux kill-session -t ${this.agent.tmuxSession}`);
        process.kill(this.agent.pid, "SIGKILL");
        console.log(`Killed agent process ${this.agent.pid}`);
      } catch (error) {
        console.error(`Failed to kill agent process ${this.agent.pid}:`, error);
      }
    }
  }
}
