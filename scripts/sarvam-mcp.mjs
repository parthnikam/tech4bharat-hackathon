import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

try {
  process.loadEnvFile(path.join(root, ".env"));
} catch (error) {
  if (error.code !== "ENOENT") {
    console.error("Could not read the project .env file:", error.message);
    process.exit(1);
  }
}

if (!process.env.SARVAM_API_KEY) {
  console.error("Set SARVAM_API_KEY in the project .env file to use Sarvam MCP.");
  process.exit(1);
}

const server = spawn("uvx", ["sarvam-mcp"], {
  cwd: root,
  env: process.env,
  stdio: "inherit"
});

server.on("error", (error) => {
  console.error("Could not start Sarvam MCP. Install uv/uvx and retry:", error.message);
  process.exitCode = 1;
});

server.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
