import AgentController from "../../../src/controllers/agent.controller";
import StartAgentHandler from "../../../src/handlers/startAgent.handler";
import WatchAgentHandler from "../../../src/handlers/watchAgent.handler";
import GetAgentStatusHandler from "../../../src/handlers/getAgentStatus.handler";
import StartAgentAndWaitHandler from "../../../src/handlers/startAgentAndWait.handler";
import StartAgentAndNotifyHandler from "../../../src/handlers/startAgentAndNotify.handler";
import KillAgentHandler from "../../../src/handlers/killAgent.handler";
import ListAgentsHandler from "../../../src/handlers/listAgents.handler";
import { AgentStatus } from "@prisma/client";

jest.mock("../../../src/handlers/startAgent.handler");
jest.mock("../../../src/handlers/watchAgent.handler");
jest.mock("../../../src/handlers/getAgentStatus.handler");
jest.mock("../../../src/handlers/startAgentAndWait.handler");
jest.mock("../../../src/handlers/startAgentAndNotify.handler");
jest.mock("../../../src/handlers/killAgent.handler");
jest.mock("../../../src/handlers/listAgents.handler");

type MockResponse = {
    status: jest.Mock;
    json: jest.Mock;
};

const makeResponse = (): MockResponse => {
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    };
    return res;
};

const StartAgentHandlerMock = StartAgentHandler as jest.MockedClass<typeof StartAgentHandler>;
const WatchAgentHandlerMock = WatchAgentHandler as jest.MockedClass<typeof WatchAgentHandler>;
const GetAgentStatusHandlerMock = GetAgentStatusHandler as jest.MockedClass<
    typeof GetAgentStatusHandler
>;
const StartAgentAndWaitHandlerMock = StartAgentAndWaitHandler as jest.MockedClass<
    typeof StartAgentAndWaitHandler
>;
const StartAgentAndNotifyHandlerMock = StartAgentAndNotifyHandler as jest.MockedClass<
    typeof StartAgentAndNotifyHandler
>;
const KillAgentHandlerMock = KillAgentHandler as jest.MockedClass<typeof KillAgentHandler>;
const ListAgentsHandlerMock = ListAgentsHandler as jest.MockedClass<typeof ListAgentsHandler>;

describe("AgentController", () => {
    const startAgentHandle = jest.fn();
    const watchAgentHandle = jest.fn();
    const getStatusHandle = jest.fn();
    const startAndWaitHandle = jest.fn();
    const startAndNotifyHandle = jest.fn();
    const killAgentHandle = jest.fn();
    const listAgentsHandle = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        startAgentHandle.mockReset();
        watchAgentHandle.mockReset();
        getStatusHandle.mockReset();
        startAndWaitHandle.mockReset();
        startAndNotifyHandle.mockReset();

        StartAgentHandlerMock.mockImplementation(
            () =>
                ({
                    handle: startAgentHandle,
                }) as any,
        );
        WatchAgentHandlerMock.mockImplementation(
            () =>
                ({
                    handle: watchAgentHandle,
                }) as any,
        );
        GetAgentStatusHandlerMock.mockImplementation(
            () =>
                ({
                    handle: getStatusHandle,
                }) as any,
        );
        StartAgentAndWaitHandlerMock.mockImplementation(
            () =>
                ({
                    handle: startAndWaitHandle,
                }) as any,
        );
        StartAgentAndNotifyHandlerMock.mockImplementation(
            () =>
                ({
                    handle: startAndNotifyHandle,
                }) as any,
        );
        KillAgentHandlerMock.mockImplementation(
            () =>
                ({
                    handle: killAgentHandle,
                }) as any,
        );
        ListAgentsHandlerMock.mockImplementation(
            () =>
                ({
                    handle: listAgentsHandle,
                }) as any,
        );
    });

    it("lists active agents with default filters", async () => {
        listAgentsHandle.mockResolvedValue([{ id: "agent-1" }]);
        const req: any = { body: {}, params: {}, query: {} };
        const res = makeResponse();

        const controller = new AgentController(req, res as any);
        await controller.list();

        expect(ListAgentsHandlerMock).toHaveBeenCalledWith({
            statuses: [AgentStatus.PREPARING, AgentStatus.LAUNCHED, AgentStatus.RUNNING],
            limit: 25,
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0].data.agents).toHaveLength(1);
    });

    it("allows overriding statuses and limit", async () => {
        listAgentsHandle.mockResolvedValue([]);
        const req: any = {
            body: {},
            params: {},
            query: { status: "COMPLETED,failed", limit: "50" },
        };
        const res = makeResponse();

        const controller = new AgentController(req, res as any);
        await controller.list();

        expect(ListAgentsHandlerMock).toHaveBeenCalledWith({
            statuses: [AgentStatus.COMPLETED, AgentStatus.FAILED],
            limit: 50,
        });
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("rejects invalid status filters", async () => {
        const req: any = { body: {}, params: {}, query: { status: "unknown" } };
        const res = makeResponse();

        const controller = new AgentController(req, res as any);
        await controller.list();

        expect(res.status).toHaveBeenCalledWith(400);
        expect(ListAgentsHandlerMock).not.toHaveBeenCalled();
    });

    it("rejects invalid limits", async () => {
        const req: any = { body: {}, params: {}, query: { limit: "-1" } };
        const res = makeResponse();

        const controller = new AgentController(req, res as any);
        await controller.list();

        expect(res.status).toHaveBeenCalledWith(400);
        expect(ListAgentsHandlerMock).not.toHaveBeenCalled();
    });

    it("validates required fields when starting an agent", async () => {
        const req: any = {
            body: { executionId: "exec" },
            params: {},
        };
        const res = makeResponse();

        const controller = new AgentController(req, res as any);
        await controller.start();

        expect(res.status).toHaveBeenCalledWith(400);
        expect(StartAgentHandlerMock).not.toHaveBeenCalled();
    });

    it("delegates to StartAgentHandler and returns success payload", async () => {
        startAgentHandle.mockResolvedValue({ agentId: "agent-1" });
        const payload = {
            executionId: "exec-1",
            codebaseId: "code-1",
            prompt: "do thing",
            role: "developer",
        };
        const req: any = { body: payload, params: {} };
        const res = makeResponse();

        const controller = new AgentController(req, res as any);
        await controller.start();

        expect(StartAgentHandlerMock).toHaveBeenCalledWith(payload);
        expect(res.status).toHaveBeenCalledWith(202);
        expect(res.json.mock.calls[0][0].data).toMatchObject({
            agentId: "agent-1",
        });
    });

    it("returns watch results", async () => {
        watchAgentHandle.mockResolvedValue({
            agentId: "agent-22",
            status: "COMPLETED",
        });
        const req: any = { body: {}, params: { id: "agent-22" } };
        const res = makeResponse();

        const controller = new AgentController(req, res as any);
        await controller.watch();

        expect(WatchAgentHandlerMock).toHaveBeenCalledWith("agent-22");
        expect(res.status).toHaveBeenCalledWith(202);
        expect(res.json.mock.calls[0][0].data.status).toBe("COMPLETED");
    });

    it("returns current status", async () => {
        getStatusHandle.mockResolvedValue({
            agentId: "agent-7",
            status: "RUNNING",
        });
        const req: any = { body: {}, params: { id: "agent-7", debugMode: false } };
        const res = makeResponse();

        const controller = new AgentController(req, res as any);
        await controller.ping();

        expect(GetAgentStatusHandlerMock).toHaveBeenCalledWith({
            agentId: "agent-7",
            debugMode: false,
        });
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("merges start and watch results when executing synchronously", async () => {
        startAndWaitHandle.mockResolvedValue({
            agentId: "agent-9",
            status: "COMPLETED",
        });
        const req: any = {
            body: {
                executionId: "exec-9",
                codebaseId: "code-9",
                prompt: "sync",
                role: "developer",
            },
            params: {},
        };
        const res = makeResponse();

        const controller = new AgentController(req, res as any);
        await controller.startAndWait();

        expect(StartAgentAndWaitHandlerMock).toHaveBeenCalledWith(req.body);
        expect(res.status).toHaveBeenCalledWith(202);
        expect(res.json.mock.calls[0][0].data.agentId).toBe("agent-9");
    });

    it("triggers async execution without waiting for result", async () => {
        startAndNotifyHandle.mockResolvedValue(undefined);
        const req: any = {
            body: {
                executionId: "exec-async",
                codebaseId: "code-async",
                prompt: "async",
                role: "developer",
                callbackUrl: "https://callback.test/hook",
            },
            params: {},
        };
        const res = makeResponse();

        const controller = new AgentController(req, res as any);
        await controller.startAndNotify();

        expect(StartAgentAndNotifyHandlerMock).toHaveBeenCalledWith(req.body);
        expect(res.status).toHaveBeenCalledWith(202);
    });

    it("kills an agent via handler", async () => {
        killAgentHandle.mockResolvedValue({
            agentId: "agent-42",
            status: "FAILED",
        });

        const req: any = {
            body: { reason: "manual" },
            params: { id: "agent-42" },
        };
        const res = makeResponse();

        const controller = new AgentController(req, res as any);
        await controller.kill();

        expect(KillAgentHandlerMock).toHaveBeenCalledWith({
            agentId: "agent-42",
            reason: "manual",
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0].success).toBe(true);
    });

    it("returns 500 when handler throws", async () => {
        watchAgentHandle.mockRejectedValue(new Error("boom"));
        const req: any = { body: {}, params: { id: "agent-fail" } };
        const res = makeResponse();

        const controller = new AgentController(req, res as any);
        await controller.watch();

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json.mock.calls[0][0].success).toBe(false);
    });
});
