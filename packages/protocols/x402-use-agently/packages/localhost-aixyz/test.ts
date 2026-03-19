import { createServer } from "node:net";

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const address = server.address();
      server.close((err) => {
        if (err) return reject(err);
        if (!address || typeof address !== "object") return reject(new Error("Failed to obtain a free port"));
        resolve(address.port);
      });
    });
    server.on("error", reject);
  });
}

/**
 * Test harness that spawns the localhost-aixyz dev server in a subprocess.
 *
 * The following environment variables can be overridden via `start({ env })`:
 *
 * | Variable               | Used in            | Default                                          |
 * |------------------------|--------------------|--------------------------------------------------|
 * | `PORT`                 | `aixyz.config.ts`  | Auto-assigned free port                           |
 * | `X402_PAY_TO`          | `aixyz.config.ts`  | `0x0000000000000000000000000000000000000000`       |
 * | `X402_NETWORK`         | `aixyz.config.ts`  | `eip155:84532`                                    |
 * | `X402_FACILITATOR_URL` | `app/accepts.ts`   | `https://x402.use-agently.com/facilitator`        |
 */
export class AixyzTesting {
  private proc: ReturnType<typeof Bun.spawn> | undefined;
  private agentUrl: string | undefined;

  getAgentHost(): string {
    if (!this.agentUrl) throw new Error("Server has not been started. Call start() first.");
    return this.agentUrl;
  }

  async start(options?: number | { port?: number; env?: Record<string, string> }): Promise<void> {
    const opts = typeof options === "number" ? { port: options } : options;
    const resolvedPort = opts?.port ?? (await getFreePort());
    this.agentUrl = `http://localhost:${resolvedPort}`;
    this.proc = Bun.spawn(["bun", "run", "dev", "--", "--port", String(resolvedPort)], {
      cwd: import.meta.dir,
      stdout: "ignore",
      stderr: "ignore",
      env: { ...process.env, PORT: String(resolvedPort), ...opts?.env },
    });
    await this.waitForServer(this.agentUrl);
  }

  async stop(): Promise<void> {
    if (this.proc) {
      this.proc.kill();
      await this.proc.exited;
      this.proc = undefined;
      this.agentUrl = undefined;
    }
  }

  private async waitForServer(url: string, timeout = 20000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const res = await fetch(`${url}/.well-known/agent-card.json`);
        if (res.ok) return;
      } catch {}
      await Bun.sleep(200);
    }
    throw new Error(`Server at ${url} did not start within ${timeout}ms`);
  }
}
