import TriggerWorkflowHandler, {
    checkDevslaveHealth,
    checkOllamaHealth,
    fetchActiveCodebases,
    fetchOllamaModels,
    runAgentPreflight,
    setupCodebase,
    type SetupCodebasePayload,
} from "../../../src/handlers/triggerWorkflow.handler";
import { AGENT_FOLDER_NAME, WEBHOOK_URL } from "../../../src/constants";

const startedPublishMock = jest.fn().mockResolvedValue(undefined);
const succeededPublishMock = jest.fn().mockResolvedValue(undefined);
const failedPublishMock = jest.fn().mockResolvedValue(undefined);
const startedPayloads: Record<string, unknown>[] = [];
const succeededPayloads: Record<string, unknown>[] = [];
const failedPayloads: Record<string, unknown>[] = [];

jest.mock("../../../src/events", () => ({
    WorkflowTriggerStarted: jest.fn().mockImplementation((data) => {
        startedPayloads.push(data);
        return {
            publish: startedPublishMock,
        };
    }),
    WorkflowTriggerSucceeded: jest.fn().mockImplementation((data) => {
        succeededPayloads.push(data);
        return {
            publish: succeededPublishMock,
        };
    }),
    WorkflowTriggerFailed: jest.fn().mockImplementation((data) => {
        failedPayloads.push(data);
        return {
            publish: failedPublishMock,
        };
    }),
}));

const originalFetch = global.fetch;

const jsonResponse = (body: Record<string, unknown>, status = 200): Response => {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
};

const textResponse = (body: string | Record<string, unknown>, status = 200): Response => {
    const payload = typeof body === "string" ? body : JSON.stringify(body);
    return new Response(payload, { status });
};

describe("TriggerWorkflowHandler", () => {
    const baseParams = {
        codebaseId: "cb-1",
        codebaseName: "Demo",
        codebasePath: "/tmp/demo",
        model: "codellama",
        debugMode: true,
    };

    beforeEach(() => {
        startedPublishMock.mockClear();
        succeededPublishMock.mockClear();
        failedPublishMock.mockClear();
        startedPayloads.length = 0;
        succeededPayloads.length = 0;
        failedPayloads.length = 0;
        global.fetch = jest.fn() as unknown as typeof fetch;
    });

    afterEach(() => {
        jest.restoreAllMocks();
        global.fetch = originalFetch;
    });

    it("triggers the webhook and publishes success events", async () => {
        const responseBody = JSON.stringify({
            executionUrl: "n8n/execution/123",
        });
        (global.fetch as jest.Mock).mockResolvedValue(
            textResponse(responseBody, 200) as unknown as Response,
        );

        const handler = new TriggerWorkflowHandler(baseParams);
        const result = await handler.handle();

        expect(global.fetch).toHaveBeenCalledWith(
            WEBHOOK_URL,
            expect.objectContaining({
                method: "POST",
            }),
        );
        expect(startedPublishMock).toHaveBeenCalledTimes(1);
        expect(succeededPublishMock).toHaveBeenCalledTimes(1);
        expect(failedPublishMock).not.toHaveBeenCalled();
        expect(startedPayloads[0]).toMatchObject({
            webhookUrl: WEBHOOK_URL,
            agentFolderName: AGENT_FOLDER_NAME,
            ...baseParams,
        });
        expect(succeededPayloads[0]).toMatchObject({
            response: JSON.parse(responseBody),
        });
        expect(result).toEqual(JSON.parse(responseBody));
    });

    it("publishes failure events when the webhook call throws", async () => {
        (global.fetch as jest.Mock).mockResolvedValue(
            textResponse("boom", 500) as unknown as Response,
        );

        const handler = new TriggerWorkflowHandler(baseParams);

        await expect(handler.handle()).rejects.toThrow("Webhook request to");

        expect(startedPublishMock).toHaveBeenCalledTimes(1);
        expect(failedPublishMock).toHaveBeenCalledTimes(1);
        expect(failedPayloads[0]).toMatchObject({
            codebaseId: baseParams.codebaseId,
            error: expect.stringContaining("500"),
        });
        expect(succeededPublishMock).not.toHaveBeenCalled();
    });
});

describe("HTTP helpers", () => {
    beforeEach(() => {
        global.fetch = jest.fn() as unknown as typeof fetch;
    });

    afterEach(() => {
        jest.restoreAllMocks();
        global.fetch = originalFetch;
    });

    it("checks devslave health via /health endpoint", async () => {
        (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ status: "ok" }));

        await expect(checkDevslaveHealth("http://app:3000")).resolves.toBeUndefined();

        expect(global.fetch).toHaveBeenCalledWith(
            "http://app:3000/health",
            expect.objectContaining({ method: "GET" }),
        );
    });

    it("throws when health endpoint fails", async () => {
        (global.fetch as jest.Mock).mockResolvedValue(
            textResponse("boom", 500) as unknown as Response,
        );

        await expect(checkDevslaveHealth("http://app:3000")).rejects.toThrow(
            "Request to http://app:3000/health failed",
        );
    });

    it("fetches ollama models from /api/tags endpoint", async () => {
        (global.fetch as jest.Mock).mockResolvedValue(
            jsonResponse({
                models: [{ name: "codellama" }, { name: "mistral", model: "mistral:latest" }],
            }),
        );

        const models = await fetchOllamaModels("http://ollama:11434");

        expect(global.fetch).toHaveBeenCalledWith(
            "http://ollama:11434/api/tags",
            expect.objectContaining({ method: "GET" }),
        );
        expect(models).toHaveLength(2);
        expect(models[1]?.model).toBe("mistral:latest");
    });

    it("falls back to legacy /tags path when /api/tags returns 404", async () => {
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce(textResponse("not found", 404) as unknown as Response)
            .mockResolvedValueOnce(
                jsonResponse({
                    models: [{ name: "legacy" }],
                }),
            );

        const models = await fetchOllamaModels("http://ollama:11434");

        expect(global.fetch as jest.Mock).toHaveBeenNthCalledWith(
            1,
            "http://ollama:11434/api/tags",
            expect.objectContaining({ method: "GET" }),
        );
        expect(global.fetch as jest.Mock).toHaveBeenNthCalledWith(
            2,
            "http://ollama:11434/tags",
            expect.objectContaining({ method: "GET" }),
        );
        expect(models[0]?.name).toBe("legacy");
    });

    it("fetches active codebases", async () => {
        (global.fetch as jest.Mock).mockResolvedValue(
            jsonResponse({
                data: {
                    codebases: [
                        { id: "cb-1", name: "Demo", path: "/demo" },
                        { id: "cb-2", name: "Other", path: "/other" },
                    ],
                },
            }),
        );

        const codebases = await fetchActiveCodebases("http://app:3000");

        expect(codebases).toHaveLength(2);
        expect(codebases[0]?.id).toBe("cb-1");
    });

    it("runs agent preflight sequence in order", async () => {
        const calls: string[] = [];
        (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
            calls.push(url);
            if (url.endsWith("/health")) {
                return jsonResponse({ status: "ok" });
            }
            if (url.endsWith("/tags")) {
                return jsonResponse({
                    models: [{ name: "codellama" }],
                });
            }
            return textResponse("OK");
        });

        const result = await runAgentPreflight({
            appBaseUrl: "http://app:3000",
            ollamaBaseUrl: "http://ollama:11434",
        });

        expect(calls).toEqual([
            "http://app:3000/health",
            "http://ollama:11434",
            "http://ollama:11434/api/tags",
        ]);
        expect(result.models[0]?.name).toBe("codellama");
    });

    it("posts setup payload to /api/codebase/setup", async () => {
        (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ success: true }));

        const payload: SetupCodebasePayload = {
            executionId: "exec-1",
            name: "Demo",
            folderName: "demo",
            prompt: "Master prompt",
            setup: "node",
        };

        await setupCodebase(payload, "http://app:3000");

        expect(global.fetch).toHaveBeenCalledWith(
            "http://app:3000/api/codebase/setup",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify(payload),
            }),
        );
    });

    it("throws when setup payload fails", async () => {
        (global.fetch as jest.Mock).mockResolvedValue(
            textResponse("boom", 500) as unknown as Response,
        );

        const payload: SetupCodebasePayload = {
            executionId: "exec-1",
            name: "Demo",
            folderName: "demo",
            prompt: "Master prompt",
            setup: "node",
        };

        await expect(setupCodebase(payload, "http://app:3000")).rejects.toThrow(
            "Request to http://app:3000/api/codebase/setup failed",
        );
    });
});

afterAll(() => {
    global.fetch = originalFetch;
});
