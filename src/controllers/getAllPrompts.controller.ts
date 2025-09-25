import { Response } from "express";
import { readFileSync, readdirSync } from "fs";
import path from "path";

async function getAllPromptsController(res: Response) {
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

    res.json({ success: true, data: prompts });
  } catch (error) {
    console.error("Error fetching prompts:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch prompts",
    });
  }
}

export default getAllPromptsController;
