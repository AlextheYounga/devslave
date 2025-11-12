import inquirer from "inquirer";
import os from "os";
import path from "path";
import { mkdtempSync, rmSync } from "fs";
import * as apiClient from "../../../src/utils/apiClient";
import {
    buildContainerProjectPath,
    ensureImportSourceDirectory,
    getMasterWorkflowWebhookUrl,
    handleAgentWorkflow,
} from "../../../src/cli/workflows";

const MASTER_ENV_KEY = "N8N_MASTER_WEBHOOK_URL";

describe("getMasterWorkflowWebhookUrl", () => {
    const originalValue = process.env[MASTER_ENV_KEY];

    afterEach(() => {
        if (originalValue === undefined) {
            delete process.env[MASTER_ENV_KEY];
        } else {
            process.env[MASTER_ENV_KEY] = originalValue;
        }
    });

    it("throws when the master webhook env var is missing", () => {
        delete process.env[MASTER_ENV_KEY];
        expect(() => getMasterWorkflowWebhookUrl()).toThrow(
            "Missing N8N_MASTER_WEBHOOK_URL environment variable.",
        );
    });

    it("returns the trimmed master webhook url", () => {
        process.env[MASTER_ENV_KEY] = " http://localhost/webhook ";
        expect(getMasterWorkflowWebhookUrl()).toBe("http://localhost/webhook");
    });
});

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
    const originalValue = process.env[MASTER_ENV_KEY];

    beforeEach(() => {
        process.env[MASTER_ENV_KEY] = "http://localhost/master-webhook";
    });

    afterEach(() => {
        jest.restoreAllMocks();

        if (originalValue === undefined) {
            delete process.env[MASTER_ENV_KEY];
        } else {
            process.env[MASTER_ENV_KEY] = originalValue;
        }
    });

    it("sends the selected codebase data to the master webhook", async () => {
        const codebase = { id: "cb-1", name: "Repo", path: "/tmp/repo" };

        jest.spyOn(apiClient, "checkDevslaveHealth").mockResolvedValue();
        jest.spyOn(apiClient, "checkOllamaHealth").mockResolvedValue();
        jest.spyOn(apiClient, "fetchOllamaModels").mockResolvedValue([]);
        jest.spyOn(apiClient, "fetchActiveCodebases").mockResolvedValue([codebase]);
        const triggerSpy = jest.spyOn(apiClient, "triggerWebhook").mockResolvedValue(undefined);

        jest.spyOn(inquirer, "prompt").mockResolvedValue({
            codebaseId: codebase.id,
            model: "",
            debugMode: true,
        });

        await handleAgentWorkflow();

        expect(triggerSpy).toHaveBeenCalledTimes(1);
        expect(triggerSpy).toHaveBeenCalledWith("http://localhost/master-webhook", {
            codebaseId: codebase.id,
            codebaseName: codebase.name,
            model: undefined,
            debugMode: true,
        });
    });
});
