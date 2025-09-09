import * as fs from "fs";
import * as path from "path";

function createDevFolder(codebasePath: string) {
  // Create .dev folder if it doesn't exist
  const devFolderPath = path.join(codebasePath, ".dev");
  if (!fs.existsSync(devFolderPath)) {
    fs.mkdirSync(devFolderPath);
  }
}

function handleGitignore(codebasePath: string) {
  const gitignorePath = path.join(codebasePath, ".gitignore");

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

export function setupCodebase(codebasePath: string) {
  handleGitignore(codebasePath);
  createDevFolder(codebasePath);
}
