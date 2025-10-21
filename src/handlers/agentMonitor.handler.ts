import { prisma } from "../prisma";
import { readFileSync, writeFile, writeFileSync } from "fs";
import { createHash } from "crypto";
import { execSync } from "child_process";
import { PrismaClient, Agent, AgentStatus } from "@prisma/client";
import { AgentRunning, AgentCompleted, AgentFailed } from "../events";

export default class AgentMonitorHandler {
  private db: PrismaClient;
  public agent: Agent;
  public status: AgentStatus = AgentStatus.LAUNCHED;
  private pollInterval = 5000; // Check every 5 seconds
  private contentHash: string | undefined;
  private eventData: any;

  constructor(agent: Agent) {
    this.db = prisma;
    this.agent = agent;
    this.status = agent.status as AgentStatus;
    this.eventData = { agentId: agent.id };
  }

  async watch(): Promise<AgentCompleted | AgentFailed> {
    const prevStatus = this.status;

    // Publish initial RUNNING event
    this.status = AgentStatus.RUNNING;
    await this.updateAgentRecord();

    new AgentRunning({
      ...this.eventData,
      status: AgentStatus.RUNNING,
      previousStatus: prevStatus,
    }).publish();

    // Poll tmux session until it goes idle
    while (await this.isSessionActive()) {
      await this.sleep(this.pollInterval);
    }

    // Session is idle - agent completed
    this.status = AgentStatus.COMPLETED;
    await this.updateAgentRecord();
    this.killTmux();

    const completedEvent = new AgentCompleted({
      ...this.eventData,
      status: AgentStatus.COMPLETED,
      previousStatus: AgentStatus.RUNNING,
    });
    completedEvent.publish();

    return completedEvent;
  }

  private async isSessionActive(): Promise<boolean> {
    try {
      this.capturePaneContent();
      const newHash = this.hashPaneContent();

      // No change in content - assume session is dead
      if (this.contentHash && this.contentHash === newHash) {
        console.log("Tmux session appears idle.");
        return false;
      }

      this.contentHash = newHash;
      console.log("Tmux session is still active.");
      return true;
    } catch(error) {
      console.error("Error checking tmux session:", error);
      this.killTmux();
      return false;
    }
  }

  private capturePaneContent() {
    const paneFile = `/tmp/agent_${this.agent.id}_pane.txt`;
    execSync(`touch ${paneFile}`);
    execSync(`tmux capture-pane -p -t ${this.agent.tmuxSession}:0 > ${paneFile}`);
  }

  private hashPaneContent() {
    const content = readFileSync(`/tmp/agent_${this.agent.id}_pane.txt`, "utf-8");
    const hash = createHash("sha256").update(content).digest("hex");
    return hash;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private killTmux() {
    try {
      execSync(`tmux kill-session -t ${this.agent.tmuxSession}`, { stdio: 'ignore' });
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
