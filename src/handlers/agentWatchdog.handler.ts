import { prisma } from "../prisma";
import { exec } from "child_process";
import { promisify } from "util";
import { PrismaClient, Agent, AgentStatus } from "@prisma/client";
import { AgentRunning, AgentCompleted, AgentFailed } from "../events";

const execAsync = promisify(exec);

export default class AgentWatchdogHandler {
  private db: PrismaClient;
  public executionId: string;
  public agent: Agent;
  public status: AgentStatus = AgentStatus.LAUNCHED;
  private pollInterval = 2000; // Check every 2 seconds
  private eventData: any;

  constructor(executionId: string, agent: Agent) {
    this.db = prisma;
    this.executionId = executionId;
    this.agent = agent;
    this.status = agent.status as AgentStatus;
    this.eventData = { executionId, agentId: agent.id };
  }

  async watch(): Promise<AgentCompleted | AgentFailed> {
    const prevStatus = this.status;
    
    // Publish initial RUNNING event
    this.status = AgentStatus.RUNNING;
    await this.updateAgentRecord();
    
    const runningEvent = new AgentRunning({
      ...this.eventData,
      status: AgentStatus.RUNNING,
      previousStatus: prevStatus,
    });
    runningEvent.publish();

    // Poll tmux session until it dies
    while (await this.isSessionAlive()) {
      await this.sleep(this.pollInterval);
    }

    // Session is dead - agent completed
    this.status = AgentStatus.COMPLETED;
    await this.updateAgentRecord();

    const completedEvent = new AgentCompleted({
      ...this.eventData,
      status: AgentStatus.COMPLETED,
      previousStatus: AgentStatus.RUNNING,
    });
    completedEvent.publish();
    
    return completedEvent;
  }

  private async isSessionAlive(): Promise<boolean> {
    try {
      await execAsync(`tmux has-session -t ${this.agent.tmuxSession}`);
      return true;
    } catch {
      return false;
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
