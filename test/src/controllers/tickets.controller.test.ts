import TicketsController from "../../../src/api/controllers/tickets.controller";
import ScanAllTicketsHandler from "../../../src/api/handlers/scanAllTickets.handler";
import ListTicketsHandler from "../../../src/api/handlers/listTickets.handler";

jest.mock("../../../src/api/handlers/scanAllTickets.handler");
jest.mock("../../../src/api/handlers/listTickets.handler");

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
const ListTicketsHandlerMock = ListTicketsHandler as jest.MockedClass<typeof ListTicketsHandler>;

describe("TicketsController", () => {
    const scanHandle = jest.fn();
    const listHandle = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        scanHandle.mockReset();
        listHandle.mockReset();
        ScanAllTicketsHandlerMock.mockImplementation(() => ({ handle: scanHandle }) as any);
        ListTicketsHandlerMock.mockImplementation(() => ({ handle: listHandle }) as any);
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

    it("lists tickets with defaults", async () => {
        listHandle.mockResolvedValue([]);
        const req: any = { query: {}, body: {}, params: {} };
        const res = makeResponse();

        await new TicketsController(req, res as any).list();

        expect(ListTicketsHandlerMock).toHaveBeenCalledWith({
            limit: 50,
        });
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("filters by status and codebaseId", async () => {
        listHandle.mockResolvedValue([]);
        const req: any = {
            query: { status: "open,closed", codebaseId: "code-1", limit: "10" },
            body: {},
            params: {},
        };
        const res = makeResponse();

        await new TicketsController(req, res as any).list();

        expect(ListTicketsHandlerMock).toHaveBeenCalledWith({
            statuses: ["OPEN", "CLOSED"],
            codebaseId: "code-1",
            limit: 10,
        });
        expect(res.status).toHaveBeenCalledWith(200);
    });

    it("rejects invalid status filters", async () => {
        const req: any = { query: { status: "unknown" }, body: {}, params: {} };
        const res = makeResponse();

        await new TicketsController(req, res as any).list();

        expect(res.status).toHaveBeenCalledWith(400);
        expect(ListTicketsHandlerMock).not.toHaveBeenCalled();
    });

    it("rejects invalid limits", async () => {
        const req: any = { query: { limit: "-1" }, body: {}, params: {} };
        const res = makeResponse();

        await new TicketsController(req, res as any).list();

        expect(res.status).toHaveBeenCalledWith(400);
        expect(ListTicketsHandlerMock).not.toHaveBeenCalled();
    });
});
