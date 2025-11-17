import { execSync } from "child_process";
import { AgentStatus, PrismaClient } from "@prisma/client";
import { prisma } from "../../prisma";
import { AgentManuallyKilled } from "../../events";

type KillAgentParams = {
    agentId: string;
    reason?: string;
};

type KillMethod = "session" | "server" | "none";

export default class KillAgentHandler {
    private readonly db: PrismaClient;
    private readonly agentId: string;
    private readonly reason: string | undefined;

    constructor(params: KillAgentParams) {
        this.db = prisma;
        this.agentId = params.agentId;
        this.reason = params.reason;
    }

    async handle() {
        const agent = await this.db.agent.findUnique({
            where: { id: this.agentId },
        });

        if (!agent) {
            throw new Error(`Agent ${this.agentId} not found.`);
        }

        const tmuxSession = agent.tmuxSession?.trim() || `agent_${agent.id}`;

        await this.db.agent.update({
            where: { id: agent.id },
            data: {
                status: AgentStatus.FAILED,
            },
        });

        const killMethod = this.killTmuxSession(tmuxSession);

        await new AgentManuallyKilled({
            agentId: agent.id,
            tmuxSession,
            killMethod,
            reason: this.reason ?? "manual_kill",
        }).publish();

        return {
            agentId: agent.id,
            tmuxSession,
            status: AgentStatus.FAILED,
            killMethod,
        };
    }

    private killTmuxSession(sessionName: string): KillMethod {
        try {
            execSync(`tmux kill-session -t ${sessionName}`, {
                stdio: "ignore",
            });
            return "session";
        } catch {
            try {
                execSync("tmux kill-server", {
                    stdio: "ignore",
                });
                return "server";
            } catch (error) {
                console.error(
                    `[KillAgentHandler] Failed to kill tmux session ${sessionName}:`,
                    error,
                );
                return "none";
            }
        }
    }
}
