import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";
import prisma from "../../client";
import SetupCodebaseHandler from "../../../src/handlers/setupCodebase.handler";

jest.mock("child_process", () => {
    const actual = jest.requireActual("child_process");
    return {
        ...actual,
        execSync: jest.fn(),
    };
});

describe("SetupCodebaseHandler", () => {
    const execSyncMock = execSync as unknown as jest.Mock;
    const originalScriptPath = process.env.SCRIPT_PATH;
    const uniqueId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    beforeAll(() => {
        process.env.SCRIPT_PATH = path.join("test", "fixtures", "scripts");
    });

    afterAll(() => {
        if (originalScriptPath) {
            process.env.SCRIPT_PATH = originalScriptPath;
        } else {
            delete process.env.SCRIPT_PATH;
        }
    });

    beforeEach(() => {
        execSyncMock.mockReset();
    });

    type SetupParams = {
        executionId: string;
        name: string;
        folderName: string;
        prompt: string;
        setup?: string;
    };

    const buildParams = (overrides: Partial<SetupParams> = {}): SetupParams => ({
        executionId: `exec-setup-${uniqueId()}`,
        name: "demo",
        folderName: `codebase-${Date.now()}`,
        prompt: "init prompt",
        ...overrides,
    });

    const makeHandler = (params: SetupParams) => new SetupCodebaseHandler(params);

    it("runs setup script for new codebase and marks it as setup", async () => {
        execSyncMock.mockReturnValue("setup complete");
        const params = buildParams();
        const handler = makeHandler(params);

        const result = await handler.handle();

        expect(result).toMatchObject({
            executionId: params.executionId,
            prompt: params.prompt,
            stdout: "setup complete",
        });

        expect(execSyncMock).toHaveBeenCalledTimes(1);

        const codebases = await prisma.codebase.findMany();
        expect(codebases).toHaveLength(1);
        const codebase = codebases[0]!;
        expect(codebase.setup).toBe(true);
        expect(codebase.path).toBe(path.join(os.tmpdir(), params.folderName));
    });

    it("skips setup when codebase already configured on disk", async () => {
        execSyncMock.mockReturnValue("should not run");
        const params = buildParams();
        const codebasePath = path.join(os.tmpdir(), params.folderName);

        fs.mkdirSync(codebasePath, { recursive: true });
        const codebase = await prisma.codebase.create({
            data: {
                name: params.name,
                path: codebasePath,
                setup: true,
                data: {
                    masterPrompt: params.prompt,
                    setupType: "default",
                },
            },
        });

        const handler = makeHandler(params);

        const result = await handler.handle();

        expect(execSyncMock).not.toHaveBeenCalled();
        expect(result).toMatchObject({
            codebaseId: codebase.id,
            stdout: "codebase already set up, skipping initialization",
        });
    });

    it("records failure event when setup script throws", async () => {
        const params = buildParams();
        execSyncMock.mockImplementation(() => {
            throw new Error("script failed");
        });
        const handler = makeHandler(params);

        await expect(handler.handle()).rejects.toThrow("script failed");
        const codebases = await prisma.codebase.findMany();
        expect(codebases).toHaveLength(1);
        expect(codebases[0]!.setup).toBe(false);
    });
});
