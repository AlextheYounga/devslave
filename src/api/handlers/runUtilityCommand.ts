import { spawn } from "child_process";

export function runUtilityCommand(command: string, args: string[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: "inherit",
            shell: true,
        });

        child.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command "${command}" exited with code ${code}`));
            }
        });

        child.on("error", (err) => {
            reject(err);
        });
    });
}
