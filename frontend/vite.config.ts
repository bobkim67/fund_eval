import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { spawn, type ChildProcess } from "node:child_process";
import { createConnection } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// FastAPI(:8001) auto-spawn — dev 시작 시 uvicorn 띄우고 종료 시 kill.
// 이미 8001 점유 중이면 skip (별도 cmd 창에서 띄운 케이스).
function fastApiPlugin(): Plugin {
  let proc: ChildProcess | null = null;

  const isPortOpen = (port: number) =>
    new Promise<boolean>((resolve) => {
      const sock = createConnection({ port, host: "127.0.0.1" });
      sock.once("connect", () => { sock.end(); resolve(true); });
      sock.once("error", () => resolve(false));
      setTimeout(() => { sock.destroy(); resolve(false); }, 500);
    });

  return {
    name: "fastapi-dev",
    apply: "serve", // dev mode 만, build 시 무시
    async configureServer(server) {
      const already = await isPortOpen(8001);
      if (already) {
        server.config.logger.info("[fastapi-dev] :8001 이미 사용 중 — spawn skip");
        return;
      }
      const webDir = path.resolve(__dirname, "..");
      const pyExe = process.env.PYTHON_EXE ||
        "C:\\Users\\user\\Downloads\\python\\.venv\\Scripts\\python.exe";
      proc = spawn(pyExe, ["-m", "uvicorn", "api.main:app", "--reload", "--port", "8001"], {
        cwd: webDir,
        stdio: "inherit",
        shell: false,
      });
      proc.on("error", (e) => server.config.logger.error(`[fastapi-dev] spawn error: ${e.message}`));
      server.config.logger.info(`[fastapi-dev] uvicorn spawned (pid=${proc.pid})`);
      const cleanup = () => { if (proc && !proc.killed) proc.kill(); };
      server.httpServer?.once("close", cleanup);
      process.once("SIGINT", cleanup);
      process.once("SIGTERM", cleanup);
      process.once("exit", cleanup);
    },
  };
}

export default defineConfig({
  plugins: [react(), fastApiPlugin()],
  base: "./",
  server: {
    port: 5174,
  },
});
