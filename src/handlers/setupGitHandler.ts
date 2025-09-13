import { PrismaClient } from "@prisma/client";
import { prisma } from "../prisma";

export class SetupGitHandler {
  private db: PrismaClient;
  public projectPath: string;

  constructor(projectPath: string) {
    this.db = prisma;
    this.projectPath = projectPath;
  }

  handle() {}
}
