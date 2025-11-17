import { prisma } from "../../prisma";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { createHash } from "crypto";
import { execSync } from "child_process";
import { PrismaClient, Agent, AgentStatus } from "@prisma/client";
import { AgentRunning, AgentCompleted, AgentFailed } from "../../events";

type AgentStatusParams = {
    agentId: string;
    debugMode: boolean;
    executionId: string | undefined;
};

type AgentStatusResult = {
    agentId: string;
    status: AgentStatus;
    tmuxSession: string;
    duration: number;
};

export default class GetAgentStatusHandler {
    private db: PrismaClient;
    private params: AgentStatusParams;
    public tmuxSession: string | null = null;
    private eventData: any;

    constructor(params: AgentStatusParams) {
        this.db = prisma;
        this.params = params;
        this.eventData = { ...params };
    }

    async handle(): Promise<AgentStatusResult> {
        let publishableEvent = new AgentRunning(this.eventData);
        const agent = await this.db.agent.findUniqueOrThrow({
            where: { id: this.params.agentId },
        });
        if (this.params.debugMode) return this.debugResponse(agent);

        this.tmuxSession = agent.tmuxSession;
        if (!this.tmuxSession) {
            throw new Error("Agent does not have an associated tmux session.");
        }

        const prevStatus = agent.status;
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
                // Leave session alive for post-run inspection
                break;
            case AgentStatus.FAILED:
                this.killAgent();
                publishableEvent = new AgentFailed(this.eventData);
                break;
        }

        // Publish event only on transition
        if (prevStatus !== nextStatus) {
            publishableEvent.publish();
            await this.updateAgentRecord(nextStatus);
        }

        const duration = this.getAgentRunDuration(agent.createdAt);
        return {
            agentId: this.params.agentId,
            status: nextStatus,
            tmuxSession: this.tmuxSession,
            duration: duration,
        };
    }

    private async isSessionAlive(): Promise<boolean> {
        try {
            execSync(`tmux has-session -t ${this.tmuxSession}`);
            return true;
        } catch (error) {
            return false;
        }
    }

    private async getAgentStatus(): Promise<AgentStatus> {
        try {
            const sessionAlive = await this.isSessionAlive();
            if (!sessionAlive) {
                console.log("Tmux session appears dead.");
                return AgentStatus.FAILED;
            }

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
        const paneFile = `/tmp/agent_cache/agent_${this.params.agentId}_pane.txt`;
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
        const hashFile = `/tmp/agent_cache/agent_${this.params.agentId}_hash.txt`;

        const lastContentHash = existsSync(hashFile)
            ? readFileSync(hashFile, "utf-8").trim()
            : null;
        // No change in content - assume session is idle
        if (lastContentHash && lastContentHash === newHash) return true;
        // Content has changed - update content hash for next run
        writeFileSync(hashFile, newHash, "utf-8");
        return false;
    }

    private killAgent() {
        try {
            execSync(`tmux kill-session -t ${this.tmuxSession}`, {
                stdio: "ignore",
            });
        } catch {
            // Session might already be dead, which is fine
        }
    }

    private async updateAgentRecord(status: AgentStatus): Promise<void> {
        await this.db.agent.update({
            where: { id: this.params.agentId },
            data: {
                status: status,
            },
        });
    }

    private getAgentRunDuration(createdAt: Date): number {
        const now = new Date();
        return now.getTime() - createdAt.getTime();
    }

    private debugResponse(agent: Agent) {
        return {
            agentId: agent.id,
            status: AgentStatus.COMPLETED,
            tmuxSession: "debug-session-id",
            duration: this.getAgentRunDuration(agent.createdAt),
        };
    }
}
