import WorkflowController from "../../../src/api/controllers/workflow.controller";
import { WorkflowPreflightHandler } from "../../../src/api/handlers/workflowPreflight.handler";
import { TriggerWorkflowHandler } from "../../../src/api/handlers/triggerWorkflow.handler";

type MockResponse = { status: jest.Mock; json: jest.Mock };

jest.mock("../../../src/api/handlers/workflowPreflight.handler");
jest.mock("../../../src/api/handlers/triggerWorkflow.handler");

const WorkflowPreflightHandlerMock = WorkflowPreflightHandler as jest.MockedClass<
    typeof WorkflowPreflightHandler
>;
const TriggerWorkflowHandlerMock = TriggerWorkflowHandler as jest.MockedClass<
    typeof TriggerWorkflowHandler
>;

const makeResponse = (): MockResponse => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
});

describe("WorkflowController", () => {
    const preflightHandle = jest.fn();
    const triggerHandle = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        preflightHandle.mockReset();
        triggerHandle.mockReset();
        WorkflowPreflightHandlerMock.mockImplementation(
            () =>
                ({
                    handle: preflightHandle,
                }) as any,
        );
        TriggerWorkflowHandlerMock.mockImplementation(
            () =>
                ({
                    handle: triggerHandle,
                }) as any,
        );
    });

    describe("preflight", () => {
        it("returns preflight data when successful", async () => {
            const res = makeResponse();
            preflightHandle.mockResolvedValue({ codebases: [], models: [] });

            await new WorkflowController({} as any, res as any).preflight();

            expect(WorkflowPreflightHandlerMock).toHaveBeenCalledTimes(1);
            expect(preflightHandle).toHaveBeenCalledTimes(1);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json.mock.calls[0][0].success).toBe(true);
        });

        it("returns 500 on handler error", async () => {
            const res = makeResponse();
            preflightHandle.mockRejectedValue(new Error("boom"));

            await new WorkflowController({} as any, res as any).preflight();

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json.mock.calls[0][0].success).toBe(false);
        });
    });

    describe("start", () => {
        it("starts workflow with provided payload", async () => {
            const res = makeResponse();
            triggerHandle.mockResolvedValue({ executionId: "exec-1" });

            await new WorkflowController(
                { body: { codebaseId: "cb-1", model: "llama", debugMode: true } } as any,
                res as any,
            ).start();

            expect(TriggerWorkflowHandlerMock).toHaveBeenCalledWith({
                codebaseId: "cb-1",
                model: "llama",
                debugMode: true,
            });
            expect(triggerHandle).toHaveBeenCalledTimes(1);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json.mock.calls[0][0].success).toBe(true);
        });

        it("defaults debugMode to false and trims model", async () => {
            const res = makeResponse();
            triggerHandle.mockResolvedValue({});

            await new WorkflowController(
                { body: { codebaseId: "cb-2", model: "   " } } as any,
                res as any,
            ).start();

            expect(TriggerWorkflowHandlerMock).toHaveBeenCalledWith({
                codebaseId: "cb-2",
                model: undefined,
                debugMode: false,
            });
        });

        it("rejects invalid payloads", async () => {
            const res = makeResponse();
            await new WorkflowController({ body: { debugMode: true } } as any, res as any).start();
            expect(res.status).toHaveBeenCalledWith(400);

            const res2 = makeResponse();
            await new WorkflowController(
                { body: { codebaseId: "cb-3", debugMode: "yes" } } as any,
                res2 as any,
            ).start();
            expect(res2.status).toHaveBeenCalledWith(400);
        });

        it("returns 500 when handler errors", async () => {
            const res = makeResponse();
            triggerHandle.mockRejectedValue(new Error("fail"));

            await new WorkflowController(
                { body: { codebaseId: "cb-1", debugMode: false } } as any,
                res as any,
            ).start();

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json.mock.calls[0][0].success).toBe(false);
        });
    });
});
