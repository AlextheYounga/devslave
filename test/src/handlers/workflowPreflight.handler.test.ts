import { WorkflowPreflightHandler } from "../../../src/api/handlers/workflowPreflight.handler";

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

const okResponse = (body: any) =>
    new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });

describe("WorkflowPreflightHandler", () => {
    beforeEach(() => {
        jest.resetModules();
        global.fetch = jest.fn();
    });

    afterEach(() => {
        global.fetch = originalFetch;
        process.env = { ...originalEnv };
    });

    it("falls back to localhost when container host is unreachable", async () => {
        (global.fetch as jest.Mock).mockImplementation((url: RequestInfo | URL) => {
            const target = String(url);
            if (target.includes("/health")) return okResponse({});
            if (target.includes("/api/codebases")) return okResponse({ data: { codebases: [] } });
            if (target.startsWith("http://ollama:11434")) {
                return Promise.reject(new Error("connect ECONNREFUSED"));
            }
            if (target.startsWith("http://localhost:11434")) {
                return okResponse({ models: [{ name: "llama" }] });
            }
            throw new Error(`Unexpected URL ${target}`);
        });

        const handler = new WorkflowPreflightHandler();
        const result = await handler.handle();
        expect(result.models).toEqual([{ name: "llama" }]);
    });

    it("returns empty list when all candidates fail", async () => {
        (global.fetch as jest.Mock).mockImplementation((url: RequestInfo | URL) => {
            const target = String(url);
            if (target.includes("/health")) return okResponse({});
            if (target.includes("/api/codebases")) return okResponse({ data: { codebases: [] } });
            return Promise.reject(new Error("connect ECONNREFUSED"));
        });

        const handler = new WorkflowPreflightHandler();
        const result = await handler.handle();
        expect(result.models).toEqual([]);
    });
});
