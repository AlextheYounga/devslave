import type { Events } from "@prisma/client";

export type EventLike = Pick<Events, "timestamp" | "type" | "data">;

function extractField(
    value: unknown,
    field: string,
    visited = new Set<object>(),
): string | undefined {
    if (!value || typeof value !== "object") {
        return undefined;
    }

    if (visited.has(value as object)) {
        return undefined;
    }
    visited.add(value as object);

    if (!Array.isArray(value)) {
        const record = value as Record<string, unknown>;
        const candidate = record[field];
        if (
            typeof candidate === "string" ||
            typeof candidate === "number" ||
            typeof candidate === "boolean"
        ) {
            return String(candidate);
        }
    }

    const children = Array.isArray(value)
        ? value
        : Object.values(value as Record<string, unknown>);

    for (const child of children) {
        if (child && typeof child === "object") {
            const result = extractField(child, field, visited);
            if (result !== undefined) {
                return result;
            }
        }
    }

    return undefined;
}

export function eventMatchesTarget(
    eventData: unknown,
    codebaseId: string,
    executionId: string,
): boolean {
    const eventCodebaseId = extractField(eventData, "codebaseId");
    const eventExecutionId = extractField(eventData, "executionId");

    return eventCodebaseId === codebaseId && eventExecutionId === executionId;
}

export function formatEventsForLogFile(events: EventLike[]): string {
    if (!events.length) {
        return "No events available for this agent.";
    }

    return events
        .map((event) => {
            const timestamp = event.timestamp.toISOString();
            const payload =
                event.data === null || typeof event.data === "undefined"
                    ? "null"
                    : JSON.stringify(event.data, null, 2);
            return `[${timestamp}] ${event.type}\n${payload}`;
        })
        .join("\n\n");
}
