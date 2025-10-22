import { prisma } from "../prisma";
import { readFileSync } from "fs";
import { createHash } from "crypto";
import { execSync } from "child_process";
import { PrismaClient, Agent, AgentStatus } from "@prisma/client";
import {
  AgentCallbackRequestSent,
  AgentMonitoringStarted,
  AgentRunning,
  AgentCompleted,
  AgentFailed,
} from "../events";

export default class AgentMonitorCallbackHandler {
  private db: PrismaClient;
  public agent: Agent;
  public callbackUrl: string;
  public status: AgentStatus = AgentStatus.LAUNCHED;
  private pollInterval = 5000; // Check every 5 seconds
  private contentHash: string | undefined;
  private eventData: any;

  constructor(agent: Agent, callbackUrl: string) {
    this.db = prisma;
    this.agent = agent;
    this.status = agent.status as AgentStatus;
    this.callbackUrl = callbackUrl;
    this.eventData = { agentId: agent.id };
  }

  async monitorWithHook(): Promise<void> {
    const prevStatus = this.status;
    let publishableEvent = new AgentRunning(this.eventData);
    new AgentMonitoringStarted(this.eventData).publish();

    // Infinite loop to monitor agent status
    while (true) {
      await this.checkAgentStatus();
      const nextStatus = this.status;
      this.eventData = {
        ...this.eventData,
        status: nextStatus,
        previousStatus: prevStatus,
      };

      if (this.status === AgentStatus.RUNNING) {
        publishableEvent = new AgentRunning(this.eventData);
        // Publish event only on transition
        if (prevStatus !== nextStatus) {
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

      await this.sleep(this.pollInterval);
    }

    publishableEvent.publish();
    await this.updateAgentRecord();
    
    // Send webhook callback for completion or failure
    if (publishableEvent instanceof AgentCompleted || publishableEvent instanceof AgentFailed) {
      await this.sendCallback(publishableEvent);
    }
    
    this.killAgent();
  }

  private async sendCallback(event: AgentCompleted | AgentFailed): Promise<void> {
    try {
      const response = await fetch(this.callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event.data),
      });

      new AgentCallbackRequestSent({
        ...this.eventData,
        callbackUrl: this.callbackUrl,
        statusCode: response.status,
        success: response.ok,
      }).publish();

      if (!response.ok) {
        console.error(`Callback request failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error sending callback:', error);
      new AgentCallbackRequestSent({
        ...this.eventData,
        callbackUrl: this.callbackUrl,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }).publish();
    }
  }

  private async checkAgentStatus(): Promise<void> {
    try {
      const sessionAlive = await this.isSessionAlive();
      if (!sessionAlive) {
        this.status = AgentStatus.FAILED;
      }

      const paneFile = this.capturePaneContent();
      const newHash = this.hashPaneContent(paneFile);

      if (this.isContentUnchanged(newHash)) {
        // No change in content - assume session is idle
        console.log("Tmux session appears idle.");
        this.status = AgentStatus.COMPLETED;
      }

      console.log("Tmux session is still active.");
      this.status = AgentStatus.RUNNING;
    } catch (error) {
      console.error("Error checking tmux session:", error);
      this.status = AgentStatus.FAILED;
    }
  }

  private async isSessionAlive(): Promise<boolean> {
    try {
      execSync(`tmux has-session -t ${this.agent.tmuxSession}`);
      return true;
    } catch (error) {
      return false;
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

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
