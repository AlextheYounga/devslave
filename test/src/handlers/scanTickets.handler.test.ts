import fs from "fs";
import os from "os";
import path from "path";
import { execSync } from "child_process";
import { TicketStatus } from "@prisma/client";
import prisma from "../../client";
import ScanTicketsHandler from "../../../src/handlers/scanAllTickets.handler";
import { AGENT_FOLDER_NAME } from "../../../src/constants";

jest.mock("child_process", () => {
    const actual = jest.requireActual("child_process") as typeof import("child_process");
    return {
        ...actual,
        execSync: jest.fn(),
    };
});

const FIXTURE_DIR = path.join(process.cwd(), "test/fixtures");
const TICKET_TEMPLATE = fs.readFileSync(
    path.join(FIXTURE_DIR, "tickets", "ticket-template.md"),
    "utf-8",
);

const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;

type TicketFixtureOptions = {
    id: string;
    title: string;
    status?: string;
    body?: string;
};

const renderTicketFixture = ({
    id,
    title,
    status = "open",
    body = "Task details here.",
}: TicketFixtureOptions) => {
    return TICKET_TEMPLATE.replace(/{{id}}/g, id)
        .replace(/{{title}}/g, title)
        .replace(/{{status}}/g, status)
        .replace(/{{body}}/g, body);
};

describe("ScanTicketsHandler", () => {
    let tempDir: string;
    let codebaseId: string;
    let executionId: string;
    const uniqueId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const ticketsDir = () => path.join(tempDir, AGENT_FOLDER_NAME, "tickets");

    const writeTicket = (filename: string, contents: string) => {
        const fullPath = path.join(ticketsDir(), filename);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, contents, "utf-8");
        return fullPath;
    };

    const mockFeatureBranches = (branches: string[] = []) => {
        mockedExecSync.mockReturnValue(branches.join("\n"));
    };

    beforeEach(() => {
        mockedExecSync.mockReset();
        mockedExecSync.mockReturnValue("");
    });

    beforeEach(async () => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "scan-handler-"));
        executionId = `exec-scan-${uniqueId()}`;
        const codebase = await prisma.codebase.create({
            data: {
                name: "ticket-source",
                path: tempDir,
                setup: true,
            },
        });
        codebaseId = codebase.id;
    });

    afterEach(() => {
        try {
            fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
            // ignore temp cleanup errors
        }
    });

    it("returns empty ticket list when tickets folder is missing", async () => {
        const handler = new ScanTicketsHandler({ executionId, codebaseId });
        const result = await handler.handle();

        expect(result).toEqual({
            tickets: [],
            nextTicket: null,
        });
    });

    it("creates tickets for markdown files and returns open ticket as nextTicket", async () => {
        writeTicket(
            "001-first-ticket.md",
            renderTicketFixture({
                id: "001",
                title: "First Ticket",
                status: "open",
                body: "Task details here.",
            }),
        );

        writeTicket(
            "002-second-ticket.md",
            renderTicketFixture({
                id: "002",
                title: "Second Ticket",
                status: "qa-review",
                body: "Follow-up details.",
            }),
        );

        const handler = new ScanTicketsHandler({ executionId, codebaseId });

        const result = await handler.handle();

        expect(result.tickets).toHaveLength(2);
        const actions = result.tickets.map((ticket) => ticket.action);
        expect(actions).toEqual(["created", "created"]);

        const nextTicket = result.nextTicket;
        expect(nextTicket?.ticketId).toBe("001");
        expect(nextTicket?.status).toBe(TicketStatus.OPEN);

        const storedTickets = await prisma.ticket.findMany({
            where: { codebaseId },
            orderBy: { ticketId: "asc" },
        });

        expect(storedTickets).toHaveLength(2);
        expect(storedTickets[0]).toMatchObject({
            ticketId: "001",
            title: "First Ticket",
            status: TicketStatus.OPEN,
            branchName: "feat/ticket-001",
        });
        expect(storedTickets[1]).toMatchObject({
            ticketId: "002",
            title: "Second Ticket",
            status: TicketStatus.QA_REVIEW,
            branchName: "feat/ticket-002",
        });
    });

    it("updates existing ticket status changes and emits status changed event", async () => {
        const existingTicketPath = path.join(ticketsDir(), "123-existing-ticket.md");

        await prisma.ticket.create({
            data: {
                codebaseId,
                ticketId: "123",
                title: "Existing ticket",
                branchName: "feat/ticket-123",
                status: TicketStatus.OPEN,
                ticketFile: existingTicketPath,
            },
        });

        writeTicket(
            "123-existing-ticket.md",
            renderTicketFixture({
                id: "123",
                title: "Existing ticket",
                status: "in-progress",
                body: "Updated body.",
            }),
        );

        const handler = new ScanTicketsHandler({ executionId, codebaseId });
        const result = await handler.handle();

        expect(result.tickets).toHaveLength(1);
        expect(result.tickets[0]).toMatchObject({
            ticketId: "123",
            action: "updated",
            status: TicketStatus.IN_PROGRESS,
        });

        const ticket = await prisma.ticket.findFirstOrThrow({
            where: { codebaseId, ticketId: "123" },
        });

        expect(ticket.status).toBe(TicketStatus.IN_PROGRESS);
    });

    it("updates stored ticket metadata even when status unchanged", async () => {
        const stableTicketPath = path.join(ticketsDir(), "888-existing.md");

        await prisma.ticket.create({
            data: {
                codebaseId,
                ticketId: "888",
                title: "Existing stable ticket",
                branchName: "feat/ticket-888",
                status: TicketStatus.QA_REVIEW,
                description: "old description",
                ticketFile: stableTicketPath,
            },
        });

        writeTicket(
            "888-existing.md",
            renderTicketFixture({
                id: "888",
                title: "Existing stable ticket",
                status: "qa-review",
                body: "Fresh description that should replace the old one.",
            }),
        );

        const handler = new ScanTicketsHandler({ executionId, codebaseId });
        const result = await handler.handle();

        expect(result.tickets).toHaveLength(1);
        expect(result.tickets[0]).toMatchObject({
            ticketId: "888",
            action: "updated",
            status: TicketStatus.QA_REVIEW,
        });

        const ticket = await prisma.ticket.findFirstOrThrow({
            where: { codebaseId, ticketId: "888" },
        });
        expect(ticket.description).toContain("Fresh description");
    });

    it("skips files that are missing required frontmatter", async () => {
        writeTicket(
            "bad-ticket.md",
            `---
title: Missing ID
---

Content that should be ignored.
`,
        );

        const handler = new ScanTicketsHandler({ executionId, codebaseId });
        const result = await handler.handle();

        expect(result.tickets).toEqual([]);
        expect(result.nextTicket).toBeNull();

        const tickets = await prisma.ticket.findMany({ where: { codebaseId } });
        expect(tickets).toHaveLength(0);
    });

    it("prefers the latest matching feature branch ticket when it is still active", async () => {
        writeTicket(
            "001-first-ticket.md",
            renderTicketFixture({
                id: "001",
                title: "First Ticket",
                status: "open",
                body: "Ticket 001 body.",
            }),
        );

        writeTicket(
            "002-second-ticket.md",
            renderTicketFixture({
                id: "002",
                title: "Second Ticket",
                status: "qa-review",
                body: "Ticket 002 body.",
            }),
        );

        const handler = new ScanTicketsHandler({ executionId, codebaseId });
        mockFeatureBranches(["feat/ticket-001", "feat/ticket-002"]);

        const result = await handler.handle();

        expect(result.nextTicket?.ticketId).toBe("002");
        expect(result.nextTicket?.status).toBe(TicketStatus.QA_REVIEW);
    });

    it("falls back to the oldest active ticket when the latest branch ticket is closed", async () => {
        writeTicket(
            "001-first-ticket.md",
            renderTicketFixture({
                id: "001",
                title: "First Ticket",
                status: "open",
                body: "Ticket 001 body.",
            }),
        );

        writeTicket(
            "002-second-ticket.md",
            renderTicketFixture({
                id: "002",
                title: "Second Ticket",
                status: "closed",
                body: "Ticket 002 body.",
            }),
        );

        const handler = new ScanTicketsHandler({ executionId, codebaseId });
        mockFeatureBranches(["feat/ticket-001", "feat/ticket-002"]);

        const result = await handler.handle();

        expect(result.nextTicket?.ticketId).toBe("001");
        expect(result.nextTicket?.status).toBe(TicketStatus.OPEN);
    });
});
