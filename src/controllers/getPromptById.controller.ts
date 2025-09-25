import { Request, Response } from "express";
import { readFileSync } from "fs";
import path from "path";

async function getPromptByIdController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const promptsFolder = path.resolve(__dirname, "../prompts");
    const content = readFileSync(`${promptsFolder}/${id}.md`, "utf-8");
    const promptData = { id: id, filename: `${id}.md`, content: content };
    res.json({ success: true, data: promptData });

  } catch (error) {
    console.error("Error fetching prompts:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch prompt",
    });
  }
}

export default getPromptByIdController;
