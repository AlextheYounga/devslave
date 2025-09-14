import * as fs from "fs";
import * as path from "path";
import { prisma } from "../prisma";

export class SetupCodebaseHandler {
  public projectPath: string;
  public name: string;

  constructor(name: string, projectPath: string) {
    this.name = name;
    this.projectPath = projectPath;
  }

  async handle() {
    this.handleGitignore();
    this.createDevFolder();
    return await this.saveCodebase();
  }

  createDevFolder() {
    // Create .dev folder if it doesn't exist
    const devFolderPath = path.join(this.projectPath, ".dev");
    if (!fs.existsSync(devFolderPath)) {
      fs.mkdirSync(devFolderPath);
    }
  }

  handleGitignore() {
    const gitignorePath = path.join(this.projectPath, ".gitignore");

    // Check if .gitignore exists, create if not
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, "");
    }

    // Read .gitignore content
    const gitignoreContent = fs.readFileSync(gitignorePath, "utf-8");

    // Add .dev line if not already present
    if (!gitignoreContent.includes(".dev")) {
      fs.appendFileSync(gitignorePath, "\n.dev");
    }
  }

  async saveCodebase() {
    // Check if codebase already exists
    const existing = await prisma.codebase.findFirst({
      where: { path: this.projectPath },
    });
    if (existing) return existing.id;

    const codebase = await prisma.codebase.create({
      data: {
        name: this.name,
        path: this.projectPath,
      },
    });

    return codebase.id;
  }
}
