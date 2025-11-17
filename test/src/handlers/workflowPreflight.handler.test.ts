import { WorkflowPreflightHandler } from "../../../src/api/handlers/workflowPreflight.handler";
import { DEFAULT_APP_BASE_URL, DEFAULT_OLLAMA_BASE_URL } from "../../../src/constants";

const originalFetch = global.fetch;

const jsonResponse = (body: Record<string, unknown>, status = 200): Response =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });

const textResponse = (body: string, status = 200): Response =>
    new Response(body, {
        status,
        headers: { "Content-Type": "text/plain" },
    });

describe("WorkflowPreflightHandler", () => {
    beforeEach(() => {
        global.fetch = jest.fn() as unknown as typeof fetch;
    });

    afterEach(() => {
        jest.restoreAllMocks();
        global.fetch = originalFetch;
    });

    it("performs preflight checks and returns codebases plus models", async () => {
        const handler = new WorkflowPreflightHandler();
        const codebases = [{ id: "cb-1", name: "Repo", path: "/tmp/repo" }];
        (global.fetch as jest.Mock)
            // DevSlave health
            .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
            // Ollama health
            .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
            // Active codebases
            .mockResolvedValueOnce(
                jsonResponse({
                    data: { codebases },
                }),
            )
            // Ollama models (/api/tags)
            .mockResolvedValueOnce(jsonResponse({ models: [{ name: "codellama" }] }));

        const result = await handler.handle();

        expect(global.fetch).toHaveBeenNthCalledWith(
            1,
            `${DEFAULT_APP_BASE_URL}/health`,
            expect.objectContaining({ method: "GET" }),
        );
        expect(global.fetch).toHaveBeenNthCalledWith(
            2,
            DEFAULT_OLLAMA_BASE_URL,
            expect.objectContaining({ method: "GET" }),
        );
        expect(global.fetch).toHaveBeenNthCalledWith(
            3,
            `${DEFAULT_APP_BASE_URL}/api/codebases`,
            expect.objectContaining({ method: "GET" }),
        );
        expect(global.fetch).toHaveBeenNthCalledWith(
            4,
            `${DEFAULT_OLLAMA_BASE_URL}/api/tags`,
            expect.objectContaining({ method: "GET" }),
        );
        expect(result.codebases).toEqual(codebases);
        expect(result.models).toEqual([{ name: "codellama" }]);
    });

    it("falls back to /tags when /api/tags is missing", async () => {
        const handler = new WorkflowPreflightHandler();

        (global.fetch as jest.Mock)
            // DevSlave health
            .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
            // Ollama health
            .mockResolvedValueOnce(jsonResponse({ status: "ok" }))
            // Active codebases
            .mockResolvedValueOnce(jsonResponse({ data: { codebases: [] } }))
            // /api/tags 404
            .mockResolvedValueOnce(textResponse("missing", 404))
            // /tags success
            .mockResolvedValueOnce(jsonResponse({ models: [{ name: "legacy" }] }));

        const result = await handler.handle();

        expect((global.fetch as jest.Mock).mock.calls[3][0]).toBe(
            `${DEFAULT_OLLAMA_BASE_URL}/api/tags`,
        );
        expect((global.fetch as jest.Mock).mock.calls[4][0]).toBe(
            `${DEFAULT_OLLAMA_BASE_URL}/tags`,
        );
        expect(result.models).toEqual([{ name: "legacy" }]);
    });

    it("throws when the DevSlave health check fails", async () => {
        const handler = new WorkflowPreflightHandler();
        (global.fetch as jest.Mock).mockResolvedValueOnce(textResponse("boom", 500));

        await expect(handler.handle()).rejects.toThrow(
            `Request to ${DEFAULT_APP_BASE_URL}/health failed with status 500`,
        );
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });
});
