import { Request, Response } from "express";
import { prisma } from "../prisma";
import { PrismaClient } from "@prisma/client";

export default class GetCodebaseController {
  private db: PrismaClient;
  private req: Request;
  private res: Response;

  constructor(req: Request, res: Response) {
    this.db = prisma;
    this.req = req;
    this.res = res;
  }

  async handleRequest() {
    // Get agentId from request url
    const codebaseId = this.req.params.id!;
    const codebase = await this.db.codebase.findUnique({
      where: { id: codebaseId },
    });

    if (!codebase) {
      return this.res.status(404).json({
        success: false,
        error: "Codebase not found",
      });
    }

    return this.res.status(200).json({
      success: true,
      message: "Codebase retrieved successfully",
      data: { codebase },
    });
  }
}
