import { Request, Response } from "express";
import GitHandler from "../handlers/git.handler";
import dotenv from "dotenv";

dotenv.config();

type RequestBody = {
  codebaseId: string;
  message?: string; // for commit
  name?: string; // for create-branch
  [key: string]: any;
};

export default class GitController {
  private req: Request;
  private res: Response;
  private data: any;
  private git: GitHandler;

  constructor(req: Request, res: Response) {
    this.req = req;
    this.res = res;
    this.git = new GitHandler();
    this.data = this.req.body as RequestBody;
  }

  async handleRequest() {
    try {
      // Determine command from URL path
      const command = this.getCommandFromPath(this.req.path);

      if (command === "commit") {
        const codebaseId = this.data.codebaseId;
        const message = this.data.message;
        const output = await this.git.commit(codebaseId, message);
        return this.res.status(200).json({
          success: true,
          data: {
            ...this.data,
            stdout: output,
          },
        });
      }

      if (command === "create-branch") {
        const codebaseId = this.data.codebaseId;
        const branchName = this.data.name;
        const output = await this.git.createBranch(codebaseId, branchName);
        return this.res.status(200).json({
          success: true,
          data: {
            ...this.data,
            stdout: output,
          },
        });
      }

      throw new Error(`Unknown command: ${command}`);
    } catch (error: any) {
      console.error("Error in GitController:", error);

      return this.res.status(500).json({
        success: false,
        error: error?.message ?? String(error),
      });
    }
  }

  private getCommandFromPath(path: string): string {
    if (path.includes("/commit")) {
      return "commit";
    }
    if (path.includes("/create-branch")) {
      return "create-branch";
    }
    throw new Error(`Unable to determine command from path: ${path}`);
  }
}
