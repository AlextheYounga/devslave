import {
    checkDevslaveHealth,
    checkOllamaHealth,
    fetchActiveCodebases,
    fetchOllamaModels,
    runAgentPreflight,
    setupCodebase,
    triggerWebhook,
    type SetupCodebasePayload,
} from "../../../src/utils/apiClient";

type FetchResponseBody = Record<string, unknown> | string;

const jsonResponse = (
    body: Record<string, unknown>,
    status = 200,
): Response => {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
};

const textResponse = (body: FetchResponseBody, status = 200): Response => {
    const payload = typeof body === "string" ? body : JSON.stringify(body);
    return new Response(payload, { status });
};

describe("apiClient helpers", () => {
    it("checks devslave health via /health endpoint", async () => {
        const fetchSpy = jest
            .fn()
            .mockResolvedValue(jsonResponse({ status: "ok" }));

        await expect(
            checkDevslaveHealth(fetchSpy, "http://app:3000"),
        ).resolves.toBeUndefined();

        expect(fetchSpy).toHaveBeenCalledWith(
            "http://app:3000/health",
            expect.objectContaining({ method: "GET" }),
        );
    });

    it("throws when health endpoint fails", async () => {
        const fetchSpy = jest
            .fn()
            .mockResolvedValue(
                textResponse("boom", 500) as unknown as Response,
            );

        await expect(
            checkDevslaveHealth(fetchSpy, "http://app:3000"),
        ).rejects.toThrow("Request to http://app:3000/health failed");
    });

    it("fetches ollama models from /api/tags endpoint", async () => {
        const fetchSpy = jest.fn().mockResolvedValue(
            jsonResponse({
                models: [
                    { name: "codellama" },
                    { name: "mistral", model: "mistral:latest" },
                ],
            }),
        );

        const models = await fetchOllamaModels(fetchSpy, "http://ollama:11434");

        expect(fetchSpy).toHaveBeenCalledWith(
            "http://ollama:11434/api/tags",
            expect.objectContaining({ method: "GET" }),
        );
        expect(models).toHaveLength(2);
        expect(models[1]?.model).toBe("mistral:latest");
    });

    it("falls back to legacy /tags path when /api/tags returns 404", async () => {
        const fetchSpy = jest
            .fn()
            .mockResolvedValueOnce(textResponse("not found", 404))
            .mockResolvedValueOnce(
                jsonResponse({
                    models: [{ name: "legacy" }],
                }),
            );

        const models = await fetchOllamaModels(fetchSpy, "http://ollama:11434");

        expect(fetchSpy).toHaveBeenNthCalledWith(
            1,
            "http://ollama:11434/api/tags",
            expect.objectContaining({ method: "GET" }),
        );
        expect(fetchSpy).toHaveBeenNthCalledWith(
            2,
            "http://ollama:11434/tags",
            expect.objectContaining({ method: "GET" }),
        );
        expect(models[0]?.name).toBe("legacy");
    });

    it("fetches active codebases", async () => {
        const fetchSpy = jest.fn().mockResolvedValue(
            jsonResponse({
                data: {
                    codebases: [
                        { id: "cb-1", name: "Demo", path: "/demo" },
                        { id: "cb-2", name: "Other", path: "/other" },
                    ],
                },
            }),
        );

        const codebases = await fetchActiveCodebases(
            fetchSpy,
            "http://app:3000",
        );

        expect(codebases).toHaveLength(2);
        expect(codebases[0]?.id).toBe("cb-1");
    });

    it("runs agent preflight sequence in order", async () => {
        const calls: string[] = [];
        const fetchSpy = jest.fn(async (url: string) => {
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

        const result = await runAgentPreflight(fetchSpy, {
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
        const fetchSpy = jest
            .fn()
            .mockResolvedValue(jsonResponse({ success: true }));

        const payload: SetupCodebasePayload = {
            executionId: "exec-1",
            name: "Demo",
            folderName: "demo",
            prompt: "Master prompt",
            setup: "node",
        };

        await setupCodebase(payload, fetchSpy, "http://app:3000");

        expect(fetchSpy).toHaveBeenCalledWith(
            "http://app:3000/api/codebase/setup",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify(payload),
            }),
        );
    });

    it("sends workflow payload to webhook", async () => {
        const fetchSpy = jest
            .fn()
            .mockResolvedValue(textResponse("OK", 200) as unknown as Response);

        await triggerWebhook(
            "http://n8n/webhook",
            { role: "architect" },
            fetchSpy,
        );

        expect(fetchSpy).toHaveBeenCalledWith(
            "http://n8n/webhook",
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({
                    "Content-Type": "application/json",
                }),
            }),
        );
    });
});
