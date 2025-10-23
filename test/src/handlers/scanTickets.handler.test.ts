import fs from "fs";
import os from "os";
import path from "path";
import { TicketStatus } from "@prisma/client";
import prisma from "../../client";
import ScanTicketsHandler from "../../../src/handlers/scanAllTickets.handler";
import { AGENT_FOLDER_NAME } from "../../../src/constants";

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
      `---
id: '001'
title: First Ticket
status: open
---

Task details here.
`
    );

    writeTicket(
      "002-second-ticket.md",
      `---
id: '002'
title: Second Ticket
status: qa-review
---

Follow-up details.
`
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
    await prisma.ticket.create({
      data: {
        codebaseId,
        ticketId: "123",
        title: "Existing ticket",
        branchName: "feat/ticket-123",
        status: TicketStatus.OPEN,
      },
    });

    writeTicket(
      "123-existing-ticket.md",
      `---
id: '123'
title: Existing ticket
status: in-progress
---

Updated body.
`
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

  it("keeps existing ticket when status unchanged", async () => {
    await prisma.ticket.create({
      data: {
        codebaseId,
        ticketId: "888",
        title: "Existing stable ticket",
        branchName: "feat/ticket-888",
        status: TicketStatus.QA_REVIEW,
        description: "old description",
      },
    });

    writeTicket(
      "888-existing.md",
      `---
id: '888'
title: Existing stable ticket
status: qa-review
---

Fresh description that should replace the old one.
`
    );

    const handler = new ScanTicketsHandler({ executionId, codebaseId });
    const result = await handler.handle();

    expect(result.tickets).toHaveLength(1);
    expect(result.tickets[0]).toMatchObject({
      ticketId: "888",
      action: "unchanged",
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
`
    );

    const handler = new ScanTicketsHandler({ executionId, codebaseId });
    const result = await handler.handle();

    expect(result.tickets).toEqual([]);
    expect(result.nextTicket).toBeNull();

    const tickets = await prisma.ticket.findMany({ where: { codebaseId } });
    expect(tickets).toHaveLength(0);
  });
});
