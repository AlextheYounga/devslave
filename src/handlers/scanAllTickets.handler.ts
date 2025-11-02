import { prisma } from "../prisma";
import { Codebase, PrismaClient, Ticket, TicketStatus } from "@prisma/client";
import { AGENT_FOLDER_NAME } from "../constants";
import { readdirSync, readFileSync, existsSync } from "fs";
import { execSync } from "child_process";
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
    public ticketsFolder: string = "";

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

            if (!codebase?.id) {
                throw new Error(
                    `Codebase with ID ${this.params.codebaseId} not found.`,
                );
            }

            this.ticketsFolder = path.join(
                codebase.path,
                `${AGENT_FOLDER_NAME}/tickets`,
            );

            if (!existsSync(this.ticketsFolder)) {
                new ScanningTicketsComplete({
                    ...this.params,
                    message: "No tickets folder found",
                    ticketsProcessed: 0,
                }).publish();

                return { tickets: [], nextTicket: null };
            }

            const ticketFiles = this.getTicketFiles();
            const scannedTickets = await this.processTicketFiles(ticketFiles);

            new ScanningTicketsComplete({
                ...this.params,
                ticketsProcessed: ticketFiles.length,
                scannedTickets: scannedTickets.map((t) => [
                    t.ticketId,
                    t.status,
                ]),
            }).publish();

            const nextTicket = await this.getNextTicket(codebase.path);

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

    private getTicketFiles(): string[] {
        return readdirSync(this.ticketsFolder).filter(
            (file) => file.endsWith(".md") || file.endsWith(".markdown"),
        );
    }

    private async processTicketFiles(ticketFiles: string[]) {
        const scannedTickets = [];

        for (const ticketFile of ticketFiles) {
            const ticketData = this.parseTicketFile(ticketFile);

            if (!ticketData) {
                continue;
            }

            const fullTicketPath = path.join(this.ticketsFolder, ticketFile);
            const ticketRecord = await this.upsertTicket(
                ticketData,
                fullTicketPath,
            );
            scannedTickets.push(ticketRecord);
        }

        return scannedTickets;
    }

    private parseTicketFile(ticketFile: string) {
        const ticketPath = path.join(this.ticketsFolder, ticketFile);
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

    private async getNextTicket(codebasePath: string) {
        const gitBranches = execSync("git branch --list", {
            cwd: codebasePath,
            encoding: "utf-8",
        });

        // Get latest feature branch
        const featureBranches = gitBranches
            .split("\n")
            .map((b) => b.replace("*", "").trim())
            .filter((b) => b.startsWith("feat/ticket-"))
            .sort();

        const latestFeatureBranch = featureBranches[featureBranches.length - 1];
        if (featureBranches.length === 0 || !latestFeatureBranch) {
            return this.getLastActiveTicket();
        }

        const ticketIdMatch = latestFeatureBranch.match(/feat\/ticket-(.+)/);
        if (!ticketIdMatch || ticketIdMatch[1] === undefined) {
            return this.getLastActiveTicket();
        }

        const branchTicket = await this.db.ticket.findFirst({
            where: {
                codebaseId: this.params.codebaseId,
                ticketId: ticketIdMatch[1],
            },
        });

        if (!branchTicket?.id || branchTicket?.status === TicketStatus.CLOSED) {
            return this.getLastActiveTicket();
        }

        return branchTicket;
    }

    private async getLastActiveTicket() {
        return this.db.ticket.findFirst({
            where: {
                codebaseId: this.params.codebaseId,
                status: {
                    in: [
                        TicketStatus.OPEN,
                        TicketStatus.QA_REVIEW,
                        TicketStatus.QA_CHANGES_REQUESTED,
                    ],
                },
            },
            orderBy: { createdAt: "asc" },
        });
    }

    private async upsertTicket(ticketData: any, ticketFilePath: string) {
        const { ticketId } = ticketData;
        const codebaseId = this.params.codebaseId;
        const existingTicket = await this.db.ticket.findFirst({
            where: {
                codebaseId,
                ticketId,
            },
        });

        if (!existingTicket) {
            return await this.createNewTicket(ticketData, ticketFilePath);
        } else {
            return await this.updateExistingTicket(
                existingTicket,
                ticketData,
                ticketFilePath,
            );
        }
    }

    private async createNewTicket(ticketData: any, ticketFilePath: string) {
        const { ticketId, title, status, description } = ticketData;
        const branchName = this.createBranchName(ticketId);
        const codebaseId = this.params.codebaseId;
        const ticketRecord = await this.db.ticket.create({
            data: {
                codebaseId,
                ticketId,
                title,
                branchName,
                description,
                ticketFile: ticketFilePath,
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

    private async updateExistingTicket(
        existingTicket: any,
        ticketData: any,
        ticketFilePath: string,
    ) {
        const { title, status, description } = ticketData;
        const ticketRecord = await this.db.ticket.update({
            where: { id: existingTicket.id },
            data: {
                title,
                description,
                status,
                ticketFile: ticketFilePath,
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
    }
}
