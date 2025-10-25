import { prisma } from "../prisma";
import { PrismaClient, AgentStatus } from "@prisma/client";
import { readFileSync } from "fs";
import { createHash } from "crypto";
import { execSync } from "child_process";
import {
  AgentMonitoringStarted,
  AgentRunning,
  AgentCompleted,
  AgentFailed,
} from "../events";

const POLL_INTERVAL_MS = 5000; // 5 seconds

type WatchAgentResult = {
  agentId: string;
  status: AgentStatus;
  tmuxSession: string;
  duration: number;
};

export default class WatchAgentHandler {
  private db: PrismaClient;
  public agentId: string;
  public status: AgentStatus = AgentStatus.LAUNCHED;
  public tmuxSession: string | null = null;
  private contentHash: string | undefined;
  private eventData: any;

  constructor(agentId: string) {
    this.db = prisma;
    this.agentId = agentId;
    this.eventData = { agentId };
  }

  async handle(): Promise<WatchAgentResult> {
    let publishableEvent = new AgentRunning(this.eventData);
    const agent = await this.db.agent.findUniqueOrThrow({ where: { id: this.agentId } });
    const prevStatus = agent.status;
    this.status = prevStatus;
    new AgentMonitoringStarted(this.eventData).publish();

    this.tmuxSession = agent.tmuxSession;
    if (!this.tmuxSession) {
      throw new Error("Agent does not have an associated tmux session.");
    }

    // Infinite loop to monitor agent status
    while (true) {
      this.status = await this.checkAgentStatus();
      this.eventData = {
        ...this.eventData,
        status: this.status,
        previousStatus: prevStatus,
      };

      if (this.status === AgentStatus.RUNNING) {
        publishableEvent = new AgentRunning(this.eventData);
        // Publish event only on transition
        if (prevStatus !== this.status) {
          publishableEvent.publish();
          await this.updateAgentRecord();
        }
      }
      if (this.status === AgentStatus.COMPLETED) {
        publishableEvent = new AgentCompleted(this.eventData);
        break;
      }
      if (this.status === AgentStatus.FAILED) {
        publishableEvent = new AgentFailed(this.eventData);
        break;
      }

      await this.sleep(POLL_INTERVAL_MS);
    }

    publishableEvent.publish();
    await this.updateAgentRecord();
    this.killAgent();
    const duration = this.getAgentRunDuration(agent.createdAt);

    return {
      agentId: this.agentId,
      status: this.status,
      tmuxSession: this.tmuxSession,
      duration,
    };
  }

  private async checkAgentStatus(): Promise<AgentStatus> {
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

  private async isSessionAlive(): Promise<boolean> {
    try {
      execSync(`tmux has-session -t ${this.tmuxSession}`);
      return true;
    } catch (error) {
      return false;
    }
  }

  private capturePaneContent() {
    const paneFile = `/tmp/agent_cache/agent_${this.agentId}_pane.txt`;
    execSync(`touch ${paneFile}`);
    execSync(`tmux capture-pane -p -t ${this.tmuxSession}:0 > ${paneFile}`);
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

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private killAgent() {
    try {
      execSync(`tmux kill-session -t ${this.tmuxSession}`, { stdio: "ignore" });
    } catch {
      // Session might already be dead, which is fine
    }
  }

  private async updateAgentRecord(): Promise<void> {
    await this.db.agent.update({
      where: { id: this.agentId },
      data: {
        status: this.status,
      },
    });
  }

  private getAgentRunDuration(createdAt: Date): number {
    const now = new Date();
    return now.getTime() - createdAt.getTime();
  }
}
