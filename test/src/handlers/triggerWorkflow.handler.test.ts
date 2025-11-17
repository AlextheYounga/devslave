import prisma from "../../client";
import { TriggerWorkflowHandler } from "../../../src/api/handlers/triggerWorkflow.handler";
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
        model: "codellama",
        debugMode: true,
    };
    const codebaseRecord = {
        id: baseParams.codebaseId,
        name: "Demo",
        path: "/tmp/demo",
    };

    beforeEach(async () => {
        startedPublishMock.mockClear();
        succeededPublishMock.mockClear();
        failedPublishMock.mockClear();
        startedPayloads.length = 0;
        succeededPayloads.length = 0;
        failedPayloads.length = 0;
        global.fetch = jest.fn() as unknown as typeof fetch;
        await prisma.codebase.create({
            data: codebaseRecord,
        });
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
            agentFolder: AGENT_FOLDER_NAME,
            codebaseId: baseParams.codebaseId,
            codebaseName: codebaseRecord.name,
            codebasePath: codebaseRecord.path,
            model: baseParams.model,
            debugMode: baseParams.debugMode,
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
afterAll(() => {
    global.fetch = originalFetch;
});
