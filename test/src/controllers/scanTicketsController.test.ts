import request from "supertest";
import express from "express";
import cors from "cors";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import routes from "../../../src/routes";
import prisma from "../../client";
import { TicketStatus } from "@prisma/client";

// Build an in-memory Express app that mirrors server.ts
function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/", routes);
  return app;
}

describe("POST /api/tickets/scan (ScanTicketsController)", () => {
  const app = buildApp();
  let tempDir: string;
  let codebaseId: string;

  beforeEach(async () => {
    jest.setTimeout(10000);
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-scan-tickets-"));
    
    // Create a codebase in the database
    const codebase = await prisma.codebase.create({
      data: {
        name: "test-codebase",
        path: tempDir,
        setup: true,
      },
    });
    codebaseId = codebase.id;
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("when tickets folder does not exist", () => {
    it("returns 200 with no tickets processed", async () => {
      const res = await request(app)
        .post("/api/tickets/scan")
        .send({
          executionId: "test-execution-123",
          codebaseId,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("No tickets folder found - scan completed");
      expect(res.body.data.ticketsProcessed).toBe(0);
    });
  });

  describe("when tickets folder exists", () => {
    beforeEach(() => {
      // Create agent/tickets directory structure
      const agentDir = path.join(tempDir, "agent");
      const ticketsDir = path.join(agentDir, "tickets");
      fs.mkdirSync(agentDir, { recursive: true });
      fs.mkdirSync(ticketsDir, { recursive: true });
    });

    it("scans and creates new tickets", async () => {
      const ticketsDir = path.join(tempDir, "agent", "tickets");
      
      // Create test ticket files
      fs.writeFileSync(
        path.join(ticketsDir, "ticket-001.md"),
        `---
id: '001'
title: First Ticket
status: open
---

## Objective
- Implement feature A

## Requirements
- Must be done by Friday
`
      );

      fs.writeFileSync(
        path.join(ticketsDir, "ticket-002.md"),
        `---
id: '002'
title: Second Ticket
status: in-progress
---

## Objective
- Fix bug B
`
      );

      const res = await request(app)
        .post("/api/tickets/scan")
        .send({
          executionId: "test-execution-123",
          codebaseId,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Tickets scanned successfully");
      expect(res.body.data.ticketsProcessed).toBe(2);
      expect(res.body.data.ticketsCreated).toBe(2);
      expect(res.body.data.ticketsUpdated).toBe(0);
      expect(res.body.data.ticketsSkipped).toBe(0);

      // Verify tickets were created in database
      const tickets = await prisma.ticket.findMany({
        where: { codebaseId },
        orderBy: { ticketId: 'asc' },
      });

      expect(tickets).toHaveLength(2);
      expect(tickets[0]).toMatchObject({
        ticketId: "001",
        title: "First Ticket",
        status: TicketStatus.OPEN,
        description: expect.stringContaining("Implement feature A"),
      });
      expect(tickets[1]).toMatchObject({
        ticketId: "002",
        title: "Second Ticket",
        status: TicketStatus.IN_PROGRESS,
        description: expect.stringContaining("Fix bug B"),
      });
    });

    it("detects status changes and fires events", async () => {
      const ticketsDir = path.join(tempDir, "agent", "tickets");
      
      // First, create a ticket in the database
      await prisma.ticket.create({
        data: {
          codebaseId,
          ticketId: "001",
          title: "Original Title",
          description: "Original description",
          status: TicketStatus.OPEN,
        },
      });

      // Create ticket file with updated status
      fs.writeFileSync(
        path.join(ticketsDir, "ticket-001.md"),
        `---
id: '001'
title: Updated Title
status: closed
---

## Objective
- Updated description
`
      );

      const res = await request(app)
        .post("/api/tickets/scan")
        .send({
          executionId: "test-execution-123",
          codebaseId,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.ticketsProcessed).toBe(1);
      expect(res.body.data.ticketsCreated).toBe(0);
      expect(res.body.data.ticketsUpdated).toBe(1);
      expect(res.body.data.ticketsSkipped).toBe(0);

      // Verify ticket was updated
      const updatedTicket = await prisma.ticket.findFirst({
        where: { codebaseId, ticketId: "001" },
      });

      expect(updatedTicket).toMatchObject({
        title: "Updated Title",
        status: TicketStatus.CLOSED,
        description: expect.stringContaining("Updated description"),
      });

      // Wait a bit for async event to be persisted
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify TicketStatusChanged event was created
      const statusChangeEvent = await prisma.events.findFirst({
        where: { type: "TicketStatusChanged" },
      });
      expect(statusChangeEvent).toBeTruthy();
    });

    it("skips files without required frontmatter", async () => {
      const ticketsDir = path.join(tempDir, "agent", "tickets");
      
      // Create invalid ticket files
      fs.writeFileSync(
        path.join(ticketsDir, "invalid-no-id.md"),
        `---
title: Missing ID
status: open
---

Content here
`
      );

      fs.writeFileSync(
        path.join(ticketsDir, "invalid-no-title.md"),
        `---
id: '002'
status: open
---

Content here
`
      );

      fs.writeFileSync(
        path.join(ticketsDir, "valid-ticket.md"),
        `---
id: '003'
title: Valid Ticket
status: open
---

Valid content
`
      );

      const res = await request(app)
        .post("/api/tickets/scan")
        .send({
          executionId: "test-execution-123",
          codebaseId,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.ticketsProcessed).toBe(3);
      expect(res.body.data.ticketsCreated).toBe(1);
      expect(res.body.data.ticketsSkipped).toBe(2);

      // Verify only valid ticket was created
      const tickets = await prisma.ticket.findMany({
        where: { codebaseId },
      });
      expect(tickets).toHaveLength(1);
      expect(tickets[0]!.ticketId).toBe("003");
    });

    it("handles various status string formats", async () => {
      const ticketsDir = path.join(tempDir, "agent", "tickets");
      
      fs.writeFileSync(
        path.join(ticketsDir, "ticket-hyphen.md"),
        `---
id: '001'
title: Hyphen Status
status: in-progress
---
Content
`
      );

      fs.writeFileSync(
        path.join(ticketsDir, "ticket-underscore.md"),
        `---
id: '002'
title: Underscore Status
status: in_review
---
Content
`
      );

      fs.writeFileSync(
        path.join(ticketsDir, "ticket-mixed-case.md"),
        `---
id: '003'
title: Mixed Case Status
status: CLOSED
---
Content
`
      );

      const res = await request(app)
        .post("/api/tickets/scan")
        .send({
          executionId: "test-execution-123",
          codebaseId,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.ticketsCreated).toBe(3);

      const tickets = await prisma.ticket.findMany({
        where: { codebaseId },
        orderBy: { ticketId: 'asc' },
      });

      expect(tickets[0]!.status).toBe(TicketStatus.IN_PROGRESS);
      expect(tickets[1]!.status).toBe(TicketStatus.IN_REVIEW);
      expect(tickets[2]!.status).toBe(TicketStatus.CLOSED);
    });

    it("handles both numeric and string IDs correctly", async () => {
      const ticketsDir = path.join(tempDir, "agent", "tickets");
      
      // Create tickets with numeric and string IDs
      fs.writeFileSync(
        path.join(ticketsDir, "ticket-numeric.md"),
        `---
id: 123
title: Numeric ID
status: open
---
Content with numeric ID
`
      );

      fs.writeFileSync(
        path.join(ticketsDir, "ticket-string.md"),
        `---
id: '456'
title: String ID
status: open
---
Content with string ID
`
      );

      const res = await request(app)
        .post("/api/tickets/scan")
        .send({
          executionId: "test-execution-123",
          codebaseId,
        })
        .expect(200);

      expect(res.body.data.ticketsCreated).toBe(2);

      const tickets = await prisma.ticket.findMany({
        where: { codebaseId },
        orderBy: { ticketId: 'asc' },
      });

      expect(tickets).toHaveLength(2);
      expect(tickets[0]!.ticketId).toBe("123"); // Numeric converted to string
      expect(tickets[1]!.ticketId).toBe("456"); // String preserved
    });

    it("defaults to OPEN status for unknown status values", async () => {
      const ticketsDir = path.join(tempDir, "agent", "tickets");
      
      fs.writeFileSync(
        path.join(ticketsDir, "ticket-unknown-status.md"),
        `---
id: '001'
title: Unknown Status
status: unknown-status
---
Content
`
      );

      const res = await request(app)
        .post("/api/tickets/scan")
        .send({
          executionId: "test-execution-123",
          codebaseId,
        })
        .expect(200);

      const ticket = await prisma.ticket.findFirst({
        where: { codebaseId, ticketId: "001" },
      });

      expect(ticket?.status).toBe(TicketStatus.OPEN);
    });

    it("filters non-markdown files", async () => {
      const ticketsDir = path.join(tempDir, "agent", "tickets");
      
      // Create various file types
      fs.writeFileSync(
        path.join(ticketsDir, "ticket.md"),
        `---
id: '001'
title: Markdown Ticket
---
Content
`
      );

      fs.writeFileSync(
        path.join(ticketsDir, "ticket.txt"),
        `---
id: '002'
title: Text File
---
Content
`
      );

      fs.writeFileSync(
        path.join(ticketsDir, "README.md"),
        `---
id: '003'
title: README
---
Content
`
      );

      const res = await request(app)
        .post("/api/tickets/scan")
        .send({
          executionId: "test-execution-123",
          codebaseId,
        })
        .expect(200);

      expect(res.body.data.ticketsProcessed).toBe(2); // Only .md files
      expect(res.body.data.ticketsCreated).toBe(2);

      const tickets = await prisma.ticket.findMany({
        where: { codebaseId },
        orderBy: { ticketId: 'asc' },
      });

      expect(tickets).toHaveLength(2);
      expect(tickets.map(t => t.ticketId)).toEqual(["001", "003"]);
    });

    it("handles empty content gracefully", async () => {
      const ticketsDir = path.join(tempDir, "agent", "tickets");
      
      fs.writeFileSync(
        path.join(ticketsDir, "empty-content.md"),
        `---
id: '001'
title: Empty Content Ticket
status: open
---

`
      );

      const res = await request(app)
        .post("/api/tickets/scan")
        .send({
          executionId: "test-execution-123",
          codebaseId,
        })
        .expect(200);

      expect(res.body.data.ticketsCreated).toBe(1);

      const ticket = await prisma.ticket.findFirst({
        where: { codebaseId, ticketId: "001" },
      });

      expect(ticket?.description).toBeNull();
    });
  });

  describe("error handling", () => {
    it("returns 500 when codebase does not exist", async () => {
      const res = await request(app)
        .post("/api/tickets/scan")
        .send({
          executionId: "test-execution-123",
          codebaseId: "non-existent-id",
        })
        .expect(500);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("Codebase with id non-existent-id not found");
    });

    it("fires ScanningTicketsFailed event on error", async () => {
      await request(app)
        .post("/api/tickets/scan")
        .send({
          executionId: "test-execution-123",
          codebaseId: "non-existent-id",
        })
        .expect(500);

      // Wait a bit for async event to be persisted
      await new Promise(resolve => setTimeout(resolve, 100));

      const failedEvent = await prisma.events.findFirst({
        where: { type: "ScanningTicketsFailed" },
      });
      expect(failedEvent).toBeTruthy();
    });
  });

  describe("event creation", () => {
    beforeEach(() => {
      const agentDir = path.join(tempDir, "agent");
      const ticketsDir = path.join(agentDir, "tickets");
      fs.mkdirSync(agentDir, { recursive: true });
      fs.mkdirSync(ticketsDir, { recursive: true });
    });

    it("creates appropriate events for successful scan", async () => {
      const ticketsDir = path.join(tempDir, "agent", "tickets");
      
      fs.writeFileSync(
        path.join(ticketsDir, "ticket-001.md"),
        `---
id: '001'
title: Test Ticket
status: open
---
Content
`
      );

      await request(app)
        .post("/api/tickets/scan")
        .send({
          executionId: "test-execution-123",
          codebaseId,
        })
        .expect(200);

      // Wait a bit for async events to be persisted
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check for ScanningTicketsStarted event
      const startedEvent = await prisma.events.findFirst({
        where: { type: "ScanningTicketsStarted" },
      });
      expect(startedEvent).toBeTruthy();

      // Check for TicketCreated event
      const createdEvent = await prisma.events.findFirst({
        where: { type: "TicketCreated" },
      });
      expect(createdEvent).toBeTruthy();

      // Check for ScanningTicketsComplete event
      const completeEvent = await prisma.events.findFirst({
        where: { type: "ScanningTicketsComplete" },
      });
      expect(completeEvent).toBeTruthy();
    });
  });
});