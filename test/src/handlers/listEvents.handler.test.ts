import { Prisma } from "@prisma/client";
import prisma from "../../client";
import ListEventsHandler from "../../../src/api/handlers/listEvents.handler";

describe("ListEventsHandler", () => {
    const createEvent = async (id: string, payload: Record<string, unknown>) => {
        await prisma.events.create({
            data: {
                id,
                type: "TestEvent",
                data: { data: payload } as Prisma.InputJsonValue,
                timestamp: new Date(),
            },
        });
    };

    it("filters by any string found in event data", async () => {
        await createEvent("evt-1", { codebaseId: "cb-123" });
        await createEvent("evt-2", { ticket: { id: "tk-456" } });
        await createEvent("evt-3", { agentId: "ag-789" });

        const result = (await new ListEventsHandler({ query: "tk-456" }).handle()) as any[];

        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe("evt-2");
    });

    it("finds id regardless of nesting level", async () => {
        await createEvent("evt-nested-1", { agent: { id: "agent-999" } });
        await createEvent("evt-nested-2", { agentId: "agent-888" });

        const result = (await new ListEventsHandler({ query: "agent-999" }).handle()) as any[];

        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe("evt-nested-1");
    });

    it("returns all events when no query filter provided", async () => {
        await createEvent("evt-all-1", { some: "data" });
        await createEvent("evt-all-2", { other: "data" });

        const result = (await new ListEventsHandler({}).handle()) as any[];

        expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it("respects limit parameter", async () => {
        await createEvent("evt-limit-1", { test: "a" });
        await createEvent("evt-limit-2", { test: "b" });
        await createEvent("evt-limit-3", { test: "c" });

        const result = (await new ListEventsHandler({ limit: 2 }).handle()) as any[];

        expect(result).toHaveLength(2);
    });
});
