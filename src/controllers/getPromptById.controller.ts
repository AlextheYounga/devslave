import { Request, Response } from "express";
import { readFileSync } from "fs";
import path from "path";

export default class GetPromptByIdController {
  constructor(private req: Request, private res: Response) {}

  async handleRequest() {
    try {
      const { id } = this.req.params as { id?: string };
      const promptsFolder = path.resolve(__dirname, "../prompts");
      const content = readFileSync(`${promptsFolder}/${id}.md`, "utf-8");
      const promptData = { id: id as string, filename: `${id}.md`, content };
      this.res.json({ success: true, data: promptData });
    } catch (error) {
      console.error("Error fetching prompts:", error);
      this.res.status(500).json({
        success: false,
        error: "Failed to fetch prompt",
      });
    }
  }
}
