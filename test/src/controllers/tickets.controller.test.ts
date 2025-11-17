import TicketsController from "../../../src/api/controllers/tickets.controller";
import ScanAllTicketsHandler from "../../../src/api/handlers/scanAllTickets.handler";

jest.mock("../../../src/api/handlers/scanAllTickets.handler");

type MockResponse = {
    status: jest.Mock;
    json: jest.Mock;
};

const makeResponse = (): MockResponse => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
});

const ScanAllTicketsHandlerMock = ScanAllTicketsHandler as jest.MockedClass<
    typeof ScanAllTicketsHandler
>;

describe("TicketsController", () => {
    const scanHandle = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        scanHandle.mockReset();
        ScanAllTicketsHandlerMock.mockImplementation(() => ({ handle: scanHandle }) as any);
    });

    it("validates payload before scanning", async () => {
        const req: any = { body: { executionId: "exec" } };
        const res = makeResponse();

        await new TicketsController(req, res as any).scan();

        expect(res.status).toHaveBeenCalledWith(400);
        expect(ScanAllTicketsHandlerMock).not.toHaveBeenCalled();
    });

    it("delegates to handler on success", async () => {
        scanHandle.mockResolvedValue({ tickets: [], nextTicket: null });
        const payload = { executionId: "exec", codebaseId: "code-1" };
        const req: any = { body: payload };
        const res = makeResponse();

        await new TicketsController(req, res as any).scan();

        expect(ScanAllTicketsHandlerMock).toHaveBeenCalledWith(payload);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0].success).toBe(true);
    });

    it("returns 500 when handler throws", async () => {
        scanHandle.mockRejectedValue(new Error("fail"));
        const payload = { executionId: "exec", codebaseId: "code-1" };
        const req: any = { body: payload };
        const res = makeResponse();

        await new TicketsController(req, res as any).scan();

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json.mock.calls[0][0].success).toBe(false);
    });
});
