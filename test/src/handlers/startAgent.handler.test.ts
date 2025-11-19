import fs from "fs";
import os from "os";
import path from "path";
import prisma from "../../client";
import { AgentStatus } from "@prisma/client";
import { AGENT_FOLDER_NAME } from "../../../src/constants";

const uniqueId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

jest.mock("child_process", () => {
    const actual = jest.requireActual("child_process");
    return {
        ...actual,
        spawn: jest.fn(),
        exec: jest.fn(),
    };
});

describe("StartAgentHandler", () => {
    const cp = require("child_process");
    const spawnMock = cp.spawn as jest.Mock;
    const execMock = cp.exec as jest.Mock;

    const sessionId = "123e4567-e89b-12d3-a456-426614174000";
    let StartAgentHandler: typeof import("../../../src/api/handlers/startAgent.handler").default;

    let originalHome: string | undefined;
    let tempHome: string;
    const originalScriptPath = process.env.SCRIPT_PATH;

    type HandlerInput = {
        executionId: string;
        codebaseId: string;
        prompt: string;
        role: "developer";
        model?: string | null | undefined;
    };

    type HandlerOverrides = Partial<Omit<HandlerInput, "model"> & { model?: string | null }>;

    const buildParams = (overrides: HandlerOverrides = {}): HandlerInput => {
        const { model, ...rest } = overrides;
        return {
            executionId: `exec-${uniqueId()}`,
            codebaseId: "codebase-abc",
            prompt: "Run task",
            role: "developer",
            ...(rest as Partial<Omit<HandlerInput, "model">>),
            model: model ?? undefined,
        };
    };

    const logDirFor = (home: string) => path.join(home, ".codex", "sessions", "2024", "01", "01");

    const createLogFile = (home: string, agentId: string) => {
        const dir = logDirFor(home);
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, `rollout-${agentId}-${sessionId}.jsonl`);
        fs.writeFileSync(file, "", "utf-8");
        return file;
    };

    beforeAll(async () => {
        process.env.SCRIPT_PATH = path.join("test", "fixtures", "scripts");
        originalHome = process.env.HOME;
        tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "agent-home-"));
        process.env.HOME = tempHome;
        await jest.isolateModulesAsync(async () => {
            StartAgentHandler = (await import("../../../src/api/handlers/startAgent.handler"))
                .default;
        });
    });

    afterAll(() => {
        if (originalScriptPath) {
            process.env.SCRIPT_PATH = originalScriptPath;
        } else {
            delete process.env.SCRIPT_PATH;
        }
        if (originalHome) {
            process.env.HOME = originalHome;
        } else {
            delete process.env.HOME;
        }
        try {
            fs.rmSync(tempHome, { recursive: true, force: true });
        } catch {
            // ignore cleanup errors
        }
    });

    beforeEach(() => {
        spawnMock.mockReset();
        execMock.mockReset();
        execMock.mockImplementation(
            (
                _cmd: string,
                callback: (error: Error | null, stdout: string, stderr: string) => void,
            ) => {
                callback(null, "", "");
                return { stdout: "" };
            },
        );
        fs.mkdirSync(path.join(process.env.HOME!, ".codex"), {
            recursive: true,
        });
    });

    afterEach(() => {
        try {
            fs.rmSync(path.join(process.env.HOME!, ".codex"), {
                recursive: true,
                force: true,
            });
        } catch {
            // ignore cleanup errors
        }
    });

    const createCodebaseFixture = async () => {
        const codebasePath = fs.mkdtempSync(path.join(os.tmpdir(), "start-agent-codebase-"));
        fs.mkdirSync(path.join(codebasePath, AGENT_FOLDER_NAME, "onboarding"), {
            recursive: true,
        });
        const codebase = await prisma.codebase.create({
            data: {
                name: `start-agent-${uniqueId()}`,
                path: codebasePath,
                setup: true,
            },
        });
        return { codebase, codebasePath };
    };

    const runHandlerWithCodebase = async (
        overrides: HandlerOverrides = {},
        callback: (
            result: Awaited<ReturnType<typeof StartAgentHandler.prototype.handle>>,
            params: HandlerInput,
        ) => Promise<void> | void,
    ) => {
        const { codebase, codebasePath } = await createCodebaseFixture();
        const params = buildParams({ ...overrides, codebaseId: codebase.id });
        const handler = new StartAgentHandler(params as any);
        let result: Awaited<ReturnType<typeof handler.handle>> | undefined;
        try {
            result = await handler.handle();
        } finally {
            fs.rmSync(codebasePath, { recursive: true, force: true });
        }

        if (!result) {
            throw new Error("StartAgentHandler did not resolve");
        }

        await callback(result, params);
    };

    it("creates agent record, launches process, and captures new log file", async () => {
        // ensure handler sees a single new log file after spawn
        spawnMock.mockImplementationOnce((_command: string, args: string[], _options: any) => {
            const agentId = args[2];
            if (agentId) {
                createLogFile(tempHome, agentId);
            }
            return {
                unref: () => undefined,
            };
        });

        await runHandlerWithCodebase({}, async (result, params) => {
            expect(result.agentId).toBeDefined();
            expect(result.tmuxSession).toBe(`agent_${result.agentId}`);

            expect(spawnMock).toHaveBeenCalledWith(
                "bash",
                [expect.stringContaining("launch-agent.sh"), params.codebaseId, result.agentId],
                expect.objectContaining({ detached: true, stdio: "ignore" }),
            );

            const agent = await prisma.agent.findUniqueOrThrow({
                where: { id: result.agentId },
            });

            expect(agent.executionId).toBe(params.executionId);
            expect(agent.codebaseId).toBe(params.codebaseId);
            expect(agent.status).toBe(AgentStatus.LAUNCHED);
        });
    });

    it("coerces null model input to the default value", async () => {
        spawnMock.mockImplementationOnce((_command: string, args: string[], _options: any) => {
            const agentId = args[2];
            if (agentId) {
                createLogFile(tempHome, agentId);
            }
            return {
                unref: () => undefined,
            };
        });

        await runHandlerWithCodebase({ model: null }, async (result, params) => {
            const agent = await prisma.agent.findUniqueOrThrow({
                where: { id: result.agentId },
            });
            expect(agent.model).toBe("default");
            expect(agent.codebaseId).toBe(params.codebaseId);
        });
    });
});
