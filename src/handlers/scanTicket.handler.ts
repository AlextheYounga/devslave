import { prisma } from "../prisma";
import { PrismaClient, Ticket, TicketStatus } from "@prisma/client";
import { TicketStatusChanged } from "../events";
import { readFileSync, existsSync } from "fs";
import matter from "gray-matter";

export default class ScanTicketHandler {
  private db: PrismaClient;
  private ticketId: string;
  private debugMode: boolean;

  constructor(ticketId: string, debugMode: boolean) {
    this.db = prisma;
    this.ticketId = ticketId;
    this.debugMode = debugMode;
  }

  async handle(): Promise<Ticket> {
    const ticket = await this.db.ticket.findUniqueOrThrow({
      where: { id: this.ticketId },
    });

    if (this.debugMode) return this.debugResponse(ticket);

    if (!existsSync(ticket.ticketFile)) {
      throw new Error(`Tickets file does not exist at path: ${ticket.ticketFile}`);
    }

    const ticketData = this.parseTicketFile(ticket.ticketFile);
    await this.updateExistingTicket(ticket, ticketData);

    return ticket;
  }

  // Convert string status from frontmatter to TicketStatus enum
  private mapStatus(status: string): TicketStatus {
    const statusMap: Record<string, TicketStatus> = {
      OPEN: TicketStatus.OPEN,
      IN_PROGRESS: TicketStatus.IN_PROGRESS,
      QA_REVIEW: TicketStatus.QA_REVIEW,
      QA_CHANGES_REQUESTED: TicketStatus.QA_CHANGES_REQUESTED,
      CLOSED: TicketStatus.CLOSED,
    };

    // Normalize status: replace underscores with hyphens, uppercase, and trim
    const normalizedStatus = status
      .toUpperCase()
      .trim()
      .replace(/_/g, "_")
      .replace(/-/g, "_");
    return statusMap[normalizedStatus] ?? TicketStatus.OPEN;
  }

  private parseTicketFile(ticketFile: string) {
    const ticketContent = readFileSync(ticketFile, "utf-8");
    const { data: frontmatter, content } = matter(ticketContent);

    // Skip files without required frontmatter
    if (!frontmatter.id || !frontmatter.title) {
      console.warn(`Skipping ${ticketFile}: missing required fields (id, title)`);
      return null;
    }

    const ticketId = String(frontmatter.id);
    const title = String(frontmatter.title);
    const status = this.mapStatus(frontmatter.status || "open");
    const description = content.trim() || null;

    return { ticketId, title, status, description };
  }

  private async updateExistingTicket(existingTicket: Ticket, ticketData: any) {
    const { title, status, description } = ticketData;

    if (existingTicket.status !== status) {
      const ticketRecord = await this.db.ticket.update({
        where: { id: existingTicket.id },
        data: {
          title,
          description,
          status,
        },
      });

      new TicketStatusChanged({
        ticket: {
          id: existingTicket.id,
          ticketId: existingTicket.ticketId,
          title,
          oldStatus: existingTicket.status,
          newStatus: status,
        },
      }).publish();

      return {
        ...ticketRecord,
        action: "updated" as const,
      };
    } else {
      const ticketRecord = await this.db.ticket.update({
        where: { id: existingTicket.id },
        data: {
          title,
          description,
        },
      });

      return {
        ...ticketRecord,
        action: "unchanged" as const,
      };
    }
  }

    private debugResponse(ticket: Ticket) {
      return {
        ...ticket,
        status: TicketStatus.CLOSED
      }
    }
}
