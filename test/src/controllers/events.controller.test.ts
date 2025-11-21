import EventsController from "../../../src/api/controllers/events.controller";
import ListEventsHandler from "../../../src/api/handlers/listEvents.handler";

type MockResponse = { status: jest.Mock; json: jest.Mock };

jest.mock("../../../src/api/handlers/listEvents.handler");

const makeResponse = (): MockResponse => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
});

const ListEventsHandlerMock = ListEventsHandler as jest.MockedClass<typeof ListEventsHandler>;

describe("EventsController", () => {
    const listHandle = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        listHandle.mockReset();
        ListEventsHandlerMock.mockImplementation(() => ({ handle: listHandle }) as any);
    });

    it("returns all events when no filter provided", async () => {
        listHandle.mockResolvedValue([{ id: "evt1" }, { id: "evt2" }]);
        const req: any = { query: {} };
        const res = makeResponse();

        await new EventsController(req, res as any).list();

        expect(ListEventsHandlerMock).toHaveBeenCalledWith({ limit: 50 });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0].data.events).toHaveLength(2);
    });

    it("returns events filtered by id", async () => {
        listHandle.mockResolvedValue([{ id: "evt" }]);
        const req: any = { query: { id: "agent-123" } };
        const res = makeResponse();

        await new EventsController(req, res as any).list();

        expect(ListEventsHandlerMock).toHaveBeenCalledWith({
            id: "agent-123",
            limit: 50,
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0].data.events).toHaveLength(1);
    });

    it("caps limit and rejects invalid values", async () => {
        const res = makeResponse();
        await new EventsController(
            { query: { id: "test-id", limit: "-1" } } as any,
            res as any,
        ).list();
        expect(res.status).toHaveBeenCalledWith(400);

        listHandle.mockResolvedValue([]);
        const res2 = makeResponse();
        await new EventsController(
            { query: { id: "test-id", limit: "500" } } as any,
            res2 as any,
        ).list();
        expect(ListEventsHandlerMock).toHaveBeenCalledWith({
            id: "test-id",
            limit: 100,
        });
    });

    it("handles handler errors", async () => {
        listHandle.mockRejectedValue(new Error("fail"));
        const req: any = { query: { id: "some-id" } };
        const res = makeResponse();

        await new EventsController(req, res as any).list();

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json.mock.calls[0][0].success).toBe(false);
    });
});
