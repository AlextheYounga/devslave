import { prisma } from "../prisma";
import { PrismaClient } from "@prisma/client";

export default class GetCodebaseHandler {
  private db: PrismaClient;
  private codebaseId: string;

  constructor(codebaseId: string) {
    this.db = prisma;
    this.codebaseId = codebaseId;
  }

  async handle() {
    return await this.db.codebase.findUniqueOrThrow({
      where: { id: this.codebaseId },
    });
  }
}
