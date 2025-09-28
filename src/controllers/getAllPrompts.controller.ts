import { Request, Response } from "express";
import { readFileSync, readdirSync } from "fs";
import path from "path";

export default class GetAllPromptsController {
  constructor(private req: Request, private res: Response) {}

  async handleRequest() {
    try {
      const promptsFolder = path.resolve(__dirname, "../prompts");
      const files = readdirSync(promptsFolder);

      const prompts = files.map((file) => {
        const content = readFileSync(`${promptsFolder}/${file}`, "utf-8");
        return {
          success: true,
          data: {
            id: file.split(".")[0],
            filename: file,
            content,
          },
        };
      });

      this.res.json({ success: true, data: prompts });
    } catch (error) {
      console.error("Error fetching prompts:", error);
      this.res.status(500).json({
        success: false,
        error: "Failed to fetch prompts",
      });
    }
  }
}
