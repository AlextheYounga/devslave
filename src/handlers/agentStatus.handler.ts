import { prisma } from "../prisma";
import { readFileSync } from "fs";
import { createHash } from "crypto";
import { exec, execSync } from "child_process";
import { PrismaClient, Agent, AgentStatus } from "@prisma/client";
import { AgentRunning, AgentCompleted, AgentFailed } from "../events";

export default class AgentStatusHandler {
  private db: PrismaClient;
  public agent: Agent;
  public status: AgentStatus = AgentStatus.LAUNCHED;
  private contentHash: string | undefined;
  private eventData: any;

  constructor(agent: Agent) {
    this.db = prisma;
    this.agent = agent;
    this.status = agent.status as AgentStatus;
    this.eventData = {
      executionId: agent.executionId,
      agentId: agent.id,
    };
  }

  async ping(): Promise<AgentCompleted | AgentRunning | AgentFailed> {
    let publishableEvent = new AgentRunning(this.eventData);
    const prevStatus = this.status;
    const nextStatus = await this.getAgentStatus();

    this.eventData = {
      ...this.eventData,
      status: nextStatus,
      previousStatus: prevStatus ?? null,
    };

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
      this.status = nextStatus;
      publishableEvent.publish();
      await this.updateAgentRecord();
    }
    return publishableEvent;
  }

  private async isSessionAlive(): Promise<boolean> {
    try {
      execSync(`tmux has-session -t ${this.agent.tmuxSession}`);
      return true;
    } catch (error) {
      return false;
    }
  }

  private async getAgentStatus(): Promise<AgentStatus> {
    try {
      const sessionAlive = await this.isSessionAlive();
      if (!sessionAlive) return AgentStatus.FAILED;

      const paneFile = this.capturePaneContent();
      const newHash = this.hashPaneContent(paneFile);

      if (this.isContentUnchanged(newHash)) {
        // No change in content - assume session is idle
        console.log("Tmux session appears idle.");
        return AgentStatus.COMPLETED;
      }

      console.log("Tmux session is still active.");
      return AgentStatus.RUNNING;
    } catch (error) {
      console.error("Error checking tmux session:", error);
      return AgentStatus.FAILED;
    }
  }

  private capturePaneContent() {
    const paneFile = `/tmp/agent_${this.agent.id}_pane.txt`;
    execSync(`touch ${paneFile}`);
    execSync(`tmux capture-pane -p -t ${this.agent.tmuxSession}:0 > ${paneFile}`);
    return paneFile;
  }

  private hashPaneContent(paneFile: string): string {
    const content = readFileSync(paneFile, "utf-8");
    const hash = createHash("sha256").update(content).digest("hex");
    return hash;
  }

  private isContentUnchanged(newHash: string) {
    // No change in content - assume session is idle
    if (this.contentHash && this.contentHash === newHash) return true;
    // Content has changed - update content hash for next run
    this.contentHash = newHash;
    return false;
  }

  private killAgent() {
    try {
      execSync(`tmux kill-session -t ${this.agent.tmuxSession}`, { stdio: "ignore" });
    } catch {
      // Session might already be dead, which is fine
    }
  }

  private async updateAgentRecord(): Promise<void> {
    await this.db.agent.update({
      where: { id: this.agent.id },
      data: {
        status: this.status,
      },
    });
  }
}
