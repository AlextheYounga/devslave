import { PrismaClient } from "@prisma/client";
import { execSync, spawn } from "child_process";
import { prisma } from "../prisma";

export class SetupCodexHandler {
  private db: PrismaClient;
  public projectPath: string;
  public codebaseId: string;

  constructor(projectPath: string, codebaseId: string) {
    this.db = prisma;
    this.projectPath = projectPath;
    this.codebaseId = codebaseId;
  }

  async handle() {
    // Initialize Codex in the project directory
    await this.initializeCodex();
  }

  private async initializeCodex() {
    try {
      await this.runCodexWithInputs(['codex', '--dangerously-bypass-approvals-and-sandbox'], [
        // Add your programmatic inputs here
        // Example: if Codex asks for confirmation, you could send 'y\n'
        // 'y\n',
        // 'some input\n',
        // etc.
      ]);
      
      console.log(`Codex initialized successfully in ${this.projectPath}`);
    } catch (error) {
      console.error('Failed to initialize Codex:', error);
      throw new Error(`Codex setup failed: ${error}`);
    }
  }

  private async runCodexWithInputs(command: string[], inputs: string[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command;
      
      if (!cmd) {
        reject(new Error('Command is required'));
        return;
      }

      const child = spawn(cmd, args, {
        cwd: this.projectPath,
        stdio: ['pipe', 'pipe', 'pipe'] // Allow us to control stdin/stdout/stderr
      });

      let inputIndex = 0;
      let output = '';
      let errorOutput = '';

      // Handle stdout (Codex output)
      child.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        console.log(text); // Still show output in console
        
        // You can add logic here to detect prompts and respond automatically
        // For example, if Codex asks a specific question, send the appropriate input
        if (inputIndex < inputs.length) {
          // Send the next programmed input
          child.stdin.write(inputs[inputIndex]);
          inputIndex++;
        }
      });

      // Handle stderr
      child.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        errorOutput += text;
        console.error(text);
      });

      // Handle process completion
      child.on('close', (code: number | null) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Codex process exited with code ${code}: ${errorOutput}`));
        }
      });

      // Handle process errors
      child.on('error', (error: Error) => {
        reject(error);
      });

      // Send initial inputs if any
      if (inputs.length > 0 && inputIndex === 0) {
        child.stdin.write(inputs[inputIndex]);
        inputIndex++;
      }

      // Close stdin when we're done sending inputs
      if (inputs.length === 0 || inputIndex >= inputs.length) {
        child.stdin.end();
      }
    });
  }
}
