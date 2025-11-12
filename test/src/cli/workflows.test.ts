import inquirer from "inquirer";
import os from "os";
import path from "path";
import { mkdtempSync, rmSync } from "fs";
import * as triggerWorkflowModule from "../../../src/handlers/triggerWorkflow.handler";
import {
    buildContainerProjectPath,
    ensureImportSourceDirectory,
    handleAgentWorkflow,
} from "../../../src/cli/workflows";
import TriggerWorkflowHandler from "../../../src/handlers/triggerWorkflow.handler";

jest.mock("../../../src/handlers/triggerWorkflow.handler");
const TriggerWorkflowHandlerMock = TriggerWorkflowHandler as jest.MockedClass<
    typeof TriggerWorkflowHandler
>;

const triggerHandlerHandleMock = jest.fn();

describe("buildContainerProjectPath", () => {
    it("normalizes workspace and folder slashes", () => {
        const result = buildContainerProjectPath("/my-app/", "/app/dev/");
        expect(result).toBe("/app/dev/my-app");
    });
});

describe("ensureImportSourceDirectory", () => {
    it("resolves with the absolute path when the directory exists", async () => {
        const tempDir = mkdtempSync(path.join(os.tmpdir(), "devslave-import-"));

        await expect(ensureImportSourceDirectory(tempDir)).resolves.toBe(path.resolve(tempDir));

        rmSync(tempDir, { recursive: true, force: true });
    });

    it("rejects when the directory does not exist", async () => {
        const missing = path.join(os.tmpdir(), `devslave-missing-${Date.now()}`);

        await expect(ensureImportSourceDirectory(missing)).rejects.toThrow("does not exist");
    });
});

describe("handleAgentWorkflow", () => {
    beforeEach(() => {
        TriggerWorkflowHandlerMock.mockImplementation(
            () =>
                ({
                    handle: triggerHandlerHandleMock,
                }) as unknown as TriggerWorkflowHandler,
        );
        triggerHandlerHandleMock.mockResolvedValue({});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        TriggerWorkflowHandlerMock.mockReset();
        triggerHandlerHandleMock.mockReset();
    });

    it("sends the selected codebase data to the master webhook", async () => {
        const codebase = { id: "cb-1", name: "Repo", path: "/tmp/repo" };

        jest.spyOn(triggerWorkflowModule, "checkDevslaveHealth").mockResolvedValue();
        jest.spyOn(triggerWorkflowModule, "checkOllamaHealth").mockResolvedValue();
        jest.spyOn(triggerWorkflowModule, "fetchOllamaModels").mockResolvedValue([]);
        jest.spyOn(triggerWorkflowModule, "fetchActiveCodebases").mockResolvedValue([codebase]);

        jest.spyOn(inquirer, "prompt").mockResolvedValue({
            codebaseId: codebase.id,
            model: "",
            debugMode: true,
        });

        await handleAgentWorkflow();

        expect(TriggerWorkflowHandlerMock).toHaveBeenCalledTimes(1);
        expect(TriggerWorkflowHandlerMock).toHaveBeenCalledWith({
            codebaseId: codebase.id,
            codebaseName: codebase.name,
            codebasePath: codebase.path,
            model: undefined,
            debugMode: true,
        });
        expect(triggerHandlerHandleMock).toHaveBeenCalledTimes(1);
    });
});
