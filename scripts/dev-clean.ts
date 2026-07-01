import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const workspace = process.cwd();
const nextDir = resolve(workspace, ".next");

function stopPort3000() {
  if (process.platform !== "win32") return;

  try {
    const output = execFileSync("netstat", ["-ano"], { encoding: "utf8" });
    const pids = new Set<string>();

    for (const line of output.split(/\r?\n/)) {
      if (!line.includes(":3000") || !line.includes("LISTENING")) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts.at(-1);
      if (pid && pid !== "0") pids.add(pid);
    }

    for (const pid of pids) {
      try {
        execFileSync("taskkill", ["/PID", pid, "/F"], { stdio: "ignore" });
        console.log(`Stopped old process on port 3000 (PID ${pid}).`);
      } catch {
        console.log(`Could not stop PID ${pid}. Close that terminal or run as administrator.`);
      }
    }
  } catch {
    console.log("Could not inspect port 3000. Continuing.");
  }
}

if (!nextDir.startsWith(workspace)) {
  throw new Error("Refusing to remove .next outside the project directory.");
}

stopPort3000();
rmSync(nextDir, { recursive: true, force: true });
console.log("Cleaned .next. Starting Next.js on http://localhost:3000 ...");

const command = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(command, ["run", "dev", "--", "-p", "3000"], {
  cwd: workspace,
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
