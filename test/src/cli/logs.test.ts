import {
    eventMatchesTarget,
    formatEventsForLogFile,
} from "../../../src/cli/logs";

describe("eventMatchesTarget", () => {
    it("matches when the identifiers exist at the top level", () => {
        const data = { codebaseId: "cb1", executionId: "exec1" };
        expect(eventMatchesTarget(data, "cb1", "exec1")).toBe(true);
    });

    it("matches when the identifiers live under the data key", () => {
        const data = { data: { codebaseId: "cb2", executionId: "exec2" } };
        expect(eventMatchesTarget(data, "cb2", "exec2")).toBe(true);
    });

    it("returns false when identifiers do not match", () => {
        const data = { codebaseId: "cb1", executionId: "exec1" };
        expect(eventMatchesTarget(data, "cb-mismatch", "exec1")).toBe(false);
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
