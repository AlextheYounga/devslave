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

    it("filters by codebaseId inside event data", async () => {
        await createEvent("evt-code-1", { codebaseId: "cb-1" });
        await createEvent("evt-code-2", { codebaseId: "cb-2" });

        const result = await new ListEventsHandler({ codebaseId: "cb-1" }).handle();

        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe("evt-code-1");
    });

    it("filters by ticketId when nested under ticket", async () => {
        await createEvent("evt-ticket-1", { ticket: { id: "t-1" } });
        await createEvent("evt-ticket-2", { ticket: { id: "t-2" } });

        const result = await new ListEventsHandler({ ticketId: "t-2" }).handle();

        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe("evt-ticket-2");
    });

    it("filters by agentId whether top-level or nested", async () => {
        await createEvent("evt-agent-1", { agentId: "a-1" });
        await createEvent("evt-agent-2", { agent: { id: "a-2" } });

        const result = await new ListEventsHandler({ agentId: "a-2" }).handle();

        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe("evt-agent-2");
    });
});
