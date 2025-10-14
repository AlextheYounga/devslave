import { Request, Response } from "express";
import { prisma } from "../prisma";
import { PrismaClient, TicketStatus } from "@prisma/client";
import { AGENT_FOLDER } from "../constants";
import { readdirSync, readFileSync, existsSync } from "fs";
import path from "path";
import matter from 'gray-matter';
import {
  ScanningTicketsStarted,
  ScanningTicketsComplete,
  ScanningTicketsFailed,
  TicketCreated,
  TicketStatusChanged,
} from "../events";

type RequestBody = {
  executionId: string;
  codebaseId: string;
};

export default class ScanTicketsController {
  private db: PrismaClient;
  private req: Request;
  private res: Response;
  private data: any;

  constructor(req: Request, res: Response) {
    this.db = prisma;
    this.req = req;
    this.res = res;
    this.data = this.req.body;
  }

  // Convert string status from frontmatter to TicketStatus enum
  private mapStatus(status: string): TicketStatus {
    const statusMap: Record<string, TicketStatus> = {
      'open': TicketStatus.OPEN,
      'in-progress': TicketStatus.IN_PROGRESS,
      'in-review': TicketStatus.IN_REVIEW,
      'closed': TicketStatus.CLOSED,
    };

    const normalizedStatus = status.toLowerCase().trim();
    return statusMap[normalizedStatus] ?? TicketStatus.OPEN;
  }

  async handleRequest() {
    try {
      const { codebaseId } = this.data as RequestBody;
      new ScanningTicketsStarted(this.data).publish();

      const codebase = await this.db.codebase.findUnique({
        where: { id: codebaseId },
      });

      if (!codebase) {
        throw new Error(`Codebase with id ${codebaseId} not found`);
      }

      const ticketsFolder = path.join(codebase.path, `${AGENT_FOLDER}/tickets`);
      
      if (!existsSync(ticketsFolder)) {
        new ScanningTicketsComplete({
          ...this.data,
          message: 'No tickets folder found',
          ticketsProcessed: 0,
        }).publish();
        
        return this.res.status(200).json({
          success: true,
          message: "No tickets folder found - scan completed",
          data: { tickets: [] },
        });
      }

      const ticketFiles = readdirSync(ticketsFolder).filter(file => 
        file.endsWith('.md') || file.endsWith('.markdown')
      );

      const scannedTickets = [];

      for (const ticketFile of ticketFiles) {
        const ticketPath = path.join(ticketsFolder, ticketFile);
        const ticketContent = readFileSync(ticketPath, "utf-8");
        const { data: frontmatter, content } = matter(ticketContent);
        
        // Skip files without required frontmatter
        if (!frontmatter.id || !frontmatter.title) {
          console.warn(`Skipping ${ticketFile}: missing required fields (id, title)`);
          continue;
        }

        const ticketId = String(frontmatter.id);
        const title = String(frontmatter.title);
        const status = this.mapStatus(frontmatter.status || 'open');
        const description = content.trim() || null;

        // Check if ticket exists
        const existingTicket = await this.db.ticket.findFirst({
          where: {
            codebaseId,
            ticketId,
          },
        });

        let ticketRecord;
        let action: 'created' | 'updated' | 'unchanged';

        if (!existingTicket) {
          // Create new ticket
          ticketRecord = await this.db.ticket.create({
            data: {
              codebaseId,
              ticketId,
              title,
              description,
              status,
            },
          });

          action = 'created';

          new TicketCreated({
            ...this.data,
            ticket: {
              id: ticketRecord.id,
              ticketId: ticketRecord.ticketId,
              title: ticketRecord.title,
              status: ticketRecord.status,
            },
          }).publish();
        } else {
          // Check if status changed
          if (existingTicket.status !== status) {
            ticketRecord = await this.db.ticket.update({
              where: { id: existingTicket.id },
              data: {
                title,
                description,
                status,
              },
            });

            action = 'updated';

            new TicketStatusChanged({
              ...this.data,
              ticket: {
                id: existingTicket.id,
                ticketId: existingTicket.ticketId,
                title,
                oldStatus: existingTicket.status,
                newStatus: status,
              },
            }).publish();
          } else {
            // Update title and description but no status change
            ticketRecord = await this.db.ticket.update({
              where: { id: existingTicket.id },
              data: {
                title,
                description,
              },
            });

            action = 'unchanged';
          }
        }

        scannedTickets.push({
          ...ticketRecord,
          action,
        });
      }

      new ScanningTicketsComplete({
        ...this.data,
        ticketsProcessed: ticketFiles.length,
        scannedTickets: scannedTickets.length,
      }).publish();

      return this.res.status(200).json({
        success: true,
        message: "Tickets scanned successfully",
        data: {
          tickets: scannedTickets,
        },
      });
    } catch (error: any) {
      console.error("Error in ScanTicketsController:", error);

      new ScanningTicketsFailed({
        ...this.data,
        error: error?.message ?? String(error),
      }).publish();

      return this.res.status(500).json({
        success: false,
        error: error?.message ?? String(error),
      });
    }
  }
}
