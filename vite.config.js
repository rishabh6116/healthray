import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { spawn } from "node:child_process";
import net from "node:net";

const API_PORT = 3000;
const API = `http://127.0.0.1:${API_PORT}`; // 127.0.0.1, not "localhost": Node may resolve localhost to ::1 and miss the Python server

// `npm run dev` also starts dev_api.py (the local stand-in for the Vercel /api functions),
// unless something is already listening on :3000 (e.g. `vercel dev` or a manual `python dev_api.py`).
function devApi() {
  let child;
  const up = () => new Promise((ok) => {
    const s = net.connect(API_PORT, "127.0.0.1");
    s.once("connect", () => { s.destroy(); ok(true); });
    s.once("error", () => ok(false));
  });
  const run = (cmds) => {
    if (!cmds.length) return console.warn("[api] Python not found. Install Python, or run `vercel dev`.");
    child = spawn(cmds[0], ["dev_api.py"], { stdio: "inherit" });
    child.once("error", () => run(cmds.slice(1)));
  };
  const stop = () => { if (child) child.kill(); };
  return {
    name: "dev-api",
    apply: "serve",
    async configureServer(server) {
      if (await up()) return;
      run(process.platform === "win32" ? ["python", "py"] : ["python3", "python"]);
      server.httpServer?.once("close", stop);
      process.once("exit", stop);
    },
  };
}

const proxy = {
  target: API,
  changeOrigin: true,
  configure: (p) => p.on("error", (_e, _req, res) => {
    if (res.writeHead && !res.headersSent) res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "API server is not running. Run: python dev_api.py" }));
  }),
};

export default defineConfig({
  plugins: [react(), devApi()],
  server: { proxy: { "/api": proxy, "/fetch": proxy } },
});
