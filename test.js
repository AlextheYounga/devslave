const { spawn } = require("node:child_process");
const fs = require("fs");


const out = fs.openSync("./codex.out.log", "a");
const err = fs.openSync("./codex.err.log", "a");

const child = spawn("codex", {
    shell: true,
    detached: false,
    stdio: ["ignore", out, err]
});

const pid = child.pid;

// Fire-and-forget: do not keep the event loop alive due to this child
child.on("error", (e) => console.error("spawn error:", e));
child.unref();
console.log(`Spawned codex with PID ${pid}`);