import { eventMatchesAgentIdentifiers, formatEventsForLogFile } from "../../../src/cli/logs";

describe("eventMatchesAgentIdentifiers", () => {
    it("matches when the agentId exists at the top level", () => {
        const data = { agentId: "agent-1" };
        expect(eventMatchesAgentIdentifiers(data, "agent-1", "exec-1")).toBe(true);
    });

    it("matches when the executionId exists nested under data", () => {
        const data = { data: { executionId: "exec-2" } };
        expect(eventMatchesAgentIdentifiers(data, "agent-x", "exec-2")).toBe(true);
    });

    it("returns false when neither identifier matches", () => {
        const data = { agentId: "agent-1", executionId: "exec-1" };
        expect(eventMatchesAgentIdentifiers(data, "agent-2", "exec-3")).toBe(false);
    });
});

describe("formatEventsForLogFile", () => {
    it("renders timestamp, type, and pretty JSON payloads", () => {
        const timestamp = new Date("2024-01-01T00:00:00.000Z");
        const output = formatEventsForLogFile([
            { timestamp, type: "AgentStarted", data: { foo: "bar" } },
        ]);

        expect(output).toContain("[2024-01-01T00:00:00.000Z] AgentStarted");
        expect(output).toContain('"foo": "bar"');
    });
});
