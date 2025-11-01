import { prisma } from "../prisma";
import { PrismaClient, Ticket, TicketStatus } from "@prisma/client";
import { AGENT_FOLDER_NAME } from "../constants";
import { readdirSync, readFileSync, existsSync } from "fs";
import path from "path";
import matter from "gray-matter";
import {
    ScanningTicketsStarted,
    ScanningTicketsComplete,
    ScanningTicketsFailed,
    TicketCreated,
    TicketStatusChanged,
} from "../events";

type ScanTicketsParams = {
    executionId: string;
    codebaseId: string;
};

type ScannedTicketsResult = {
    tickets: any[];
    nextTicket: Ticket | null;
};

export default class ScanAllTicketsHandler {
    private db: PrismaClient;
    private params: ScanTicketsParams;

    constructor(params: ScanTicketsParams) {
        this.db = prisma;
        this.params = params;
    }

    async handle(): Promise<ScannedTicketsResult> {
        try {
            new ScanningTicketsStarted(this.params).publish();

            const codebase = await this.db.codebase.findUniqueOrThrow({
                where: { id: this.params.codebaseId },
            });
            const ticketsFolder = path.join(
                codebase.path,
                `${AGENT_FOLDER_NAME}/tickets`,
            );

            if (!existsSync(ticketsFolder)) {
                new ScanningTicketsComplete({
                    ...this.params,
                    message: "No tickets folder found",
                    ticketsProcessed: 0,
                }).publish();

                return { tickets: [], nextTicket: null };
            }

            const ticketFiles = this.getTicketFiles(ticketsFolder);
            const scannedTickets = await this.processTicketFiles(
                ticketFiles,
                ticketsFolder,
                codebase.id,
            );

            new ScanningTicketsComplete({
                ...this.params,
                ticketsProcessed: ticketFiles.length,
                scannedTickets: scannedTickets.map((t) => t.ticketId),
            }).publish();

            const nextTicket = scannedTickets.find(
                (t) => t.status === TicketStatus.OPEN,
            );

            return {
                tickets: scannedTickets,
                nextTicket: nextTicket || null,
            };
        } catch (error: any) {
            new ScanningTicketsFailed({
                ...this.params,
                error: error.message,
            }).publish();
            throw error;
        }
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

    private createBranchName(ticketId: string) {
        return `feat/ticket-${ticketId}`;
    }

    private getTicketFiles(ticketsFolder: string): string[] {
        return readdirSync(ticketsFolder).filter(
            (file) => file.endsWith(".md") || file.endsWith(".markdown"),
        );
    }

    private async processTicketFiles(
        ticketFiles: string[],
        ticketsFolder: string,
        codebaseId: string,
    ) {
        const scannedTickets = [];

        for (const ticketFile of ticketFiles) {
            const ticketData = this.parseTicketFile(ticketsFolder, ticketFile);

            if (!ticketData) {
                continue;
            }

            const ticketRecord = await this.upsertTicket(
                ticketData,
                codebaseId,
                ticketFile,
            );
            scannedTickets.push(ticketRecord);
        }

        return scannedTickets;
    }

    private parseTicketFile(ticketsFolder: string, ticketFile: string) {
        const ticketPath = path.join(ticketsFolder, ticketFile);
        const ticketContent = readFileSync(ticketPath, "utf-8");
        const { data: frontmatter, content } = matter(ticketContent);

        // Skip files without required frontmatter
        if (!frontmatter.id || !frontmatter.title) {
            console.warn(
                `Skipping ${ticketFile}: missing required fields (id, title)`,
            );
            return null;
        }

        const ticketId = String(frontmatter.id);
        const title = String(frontmatter.title);
        const status = this.mapStatus(frontmatter.status || "open");
        const description = content.trim() || null;

        return { ticketId, title, status, description };
    }

    private async upsertTicket(
        ticketData: any,
        codebaseId: string,
        ticketFile: string,
    ) {
        const { ticketId } = ticketData;

        const existingTicket = await this.db.ticket.findFirst({
            where: {
                codebaseId,
                ticketId,
            },
        });

        if (!existingTicket) {
            return await this.createNewTicket(
                ticketData,
                codebaseId,
                ticketFile,
            );
        } else {
            return await this.updateExistingTicket(existingTicket, ticketData);
        }
    }

    private async createNewTicket(
        ticketData: any,
        codebaseId: string,
        ticketFile: string,
    ) {
        const { ticketId, title, status, description } = ticketData;
        const branchName = this.createBranchName(ticketId);

        const ticketRecord = await this.db.ticket.create({
            data: {
                codebaseId,
                ticketId,
                title,
                branchName,
                description,
                ticketFile,
                status,
            },
        });

        new TicketCreated({
            ...this.params,
            ticket: {
                id: ticketRecord.id,
                ticketId: ticketRecord.ticketId,
                title: ticketRecord.title,
                status: ticketRecord.status,
            },
        }).publish();

        return {
            ...ticketRecord,
            action: "created" as const,
        };
    }

    private async updateExistingTicket(existingTicket: any, ticketData: any) {
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
                ...this.params,
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
}
