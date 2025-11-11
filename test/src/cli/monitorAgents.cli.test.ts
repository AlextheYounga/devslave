import { prisma } from "../../../src/prisma";

// SUTs
import { fetchRunningAgents, streamAgentLogs } from "../../../src/cli/monitor";

jest.mock("inquirer");

jest.mock("../../../src/handlers/getExecutionLogs.handler", () => {
    return {
        __esModule: true,
        default: class MockGetExecutionLogsHandler {
            executionId: string;
            static calls: number = 0;
            constructor(executionId: string) {
                this.executionId = executionId;
            }
            async handle() {
                MockGetExecutionLogsHandler.calls++;
                const seq = MockGetExecutionLogsHandler.calls;
                const base = ["A"];
                if (seq >= 2) base.push("B");
                if (seq >= 3) base.push("C");
                return {
                    executionId: this.executionId,
                    logFile: "/tmp/fake.log",
                    entries: base.length,
                    lines: base,
                };
            }
        },
    };
});

describe("CLI monitor agents", () => {
    beforeEach(async () => {
        await prisma.agent.deleteMany();
        await prisma.codebase.deleteMany();
        await prisma.events.deleteMany();
    });

    it("fetchRunningAgents returns only active statuses", async () => {
        const create = (status: any, id: string, executionId: string) =>
            prisma.agent.create({
                data: { id, status, executionId, model: "m" } as any,
            });

        await create("PREPARING", "a1", "e1");
        await create("LAUNCHED", "a2", "e2");
        await create("RUNNING", "a3", "e3");
        await create("COMPLETED", "a4", "e4");
        await create("FAILED", "a5", "e5");

        const agents = await fetchRunningAgents();
        const ids = agents.map((a) => a.id).sort();
        expect(ids).toEqual(["a1", "a2", "a3"]);
    });

    it("streamAgentLogs emits only new lines across polls and stops after stop()", async () => {
        const printed: string[] = [];
        const controller = new AbortController();

        const task = streamAgentLogs("exec-1", {
            pollMs: 10,
            onLines: (lines) => printed.push(...lines),
            signal: controller.signal,
        });

        // wait a bit to allow several polls
        await new Promise((r) => setTimeout(r, 50));
        controller.abort();
        await task; // should resolve cleanly

        // Expect to have received A on first loop, then B, then C (no duplicates)
        expect(printed).toEqual(["A", "B", "C"]);
    });
});
