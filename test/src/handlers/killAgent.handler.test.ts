import { AgentStatus } from "@prisma/client";
import prisma from "../../client";

jest.mock("child_process", () => ({
    execSync: jest.fn(),
}));

describe("KillAgentHandler", () => {
    const execSyncMock = require("child_process").execSync as jest.Mock;
    let KillAgentHandler: typeof import("../../../src/api/handlers/killAgent.handler").default;

    beforeAll(async () => {
        KillAgentHandler = (await import("../../../src/api/handlers/killAgent.handler")).default;
    });

    beforeEach(() => {
        execSyncMock.mockReset();
    });

    it("marks the agent as failed and kills its tmux session", async () => {
        execSyncMock.mockImplementation(() => undefined);

        const agent = await prisma.agent.create({
            data: {
                executionId: "exec-kill",
                tmuxSession: "tmux_kill_session",
                status: AgentStatus.RUNNING,
                prompt: "prompt",
                role: "developer",
            },
        });

        const handler = new KillAgentHandler({
            agentId: agent.id,
            reason: "test",
        });

        const result = await handler.handle();

        expect(execSyncMock).toHaveBeenCalledWith("tmux kill-session -t tmux_kill_session", {
            stdio: "ignore",
        });
        expect(result).toMatchObject({
            agentId: agent.id,
            status: AgentStatus.FAILED,
            tmuxSession: "tmux_kill_session",
            killMethod: "session",
        });

        const updated = await prisma.agent.findUniqueOrThrow({
            where: { id: agent.id },
        });
        expect(updated.status).toBe(AgentStatus.FAILED);
    });
});
