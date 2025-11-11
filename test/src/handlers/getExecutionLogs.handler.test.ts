import fs from "fs";
import path from "path";

const fixturePath = path.join(__dirname, "../../fixtures/n8n-logs.json");

// lazy import after jest setup to capture global fetch
let GetExecutionLogsHandler: typeof import("../../../src/handlers/getExecutionLogs.handler").default;

const loadHandler = async () => {
    await jest.isolateModulesAsync(async () => {
        GetExecutionLogsHandler = (
            await import("../../../src/handlers/getExecutionLogs.handler")
        ).default;
    });
};

describe("GetExecutionLogsHandler", () => {
    const realFetch = global.fetch;

    beforeEach(async () => {
        process.env.N8N_BASE_URL = "http://127.0.0.1:5678";
        process.env.N8N_API_KEY = "test-api-key";
        (global as any).fetch = jest.fn();
        await loadHandler();
    });

    afterEach(() => {
        if (realFetch) {
            (global as any).fetch = realFetch;
        } else {
            delete (global as any).fetch;
        }
        // cleanup logs produced during tests
        const logFile = path.join(
            path.resolve(__dirname, "../../../.."),
            "logs",
            "execution-1.log",
        );
        try {
            fs.unlinkSync(logFile);
        } catch {}
    });

    it("writes a .log file with node statuses and start times", async () => {
        const json = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => json,
            text: async () => JSON.stringify(json),
        });

        const handler = new GetExecutionLogsHandler("1");
        const result = await handler.handle();

        expect(result.executionId).toBe("1");
        expect(result.logFile).toContain(path.sep + "logs" + path.sep);
        expect(result.entries).toBeGreaterThan(0);

        const written = fs.readFileSync(result.logFile, "utf-8");
        const lines = written.split(/\n/).filter(Boolean);
        expect(lines.length).toBe(result.entries);

        // spot-check a couple of expected nodes from the fixture
        const hasArchitectWebhook = lines.some((l) =>
            /^Architect Webhook\s+success\s+\d+$/.test(l),
        );
        const hasRespondToWebhook = lines.some((l) =>
            /^Respond to Webhook\s+success\s+\d+$/.test(l),
        );
        expect(hasArchitectWebhook).toBe(true);
        expect(hasRespondToWebhook).toBe(true);
    });

    it("throws if env vars are missing", async () => {
        delete process.env.N8N_BASE_URL;
        delete process.env.N8N_API_KEY;

        await loadHandler();
        const handler = new GetExecutionLogsHandler("1");

        await expect(handler.handle()).rejects.toThrow(
            /Missing required env vars:/,
        );
    });
});
