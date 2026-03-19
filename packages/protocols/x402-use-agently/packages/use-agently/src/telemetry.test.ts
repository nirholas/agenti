import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

describe("telemetry", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
    delete process.env.USE_AGENTLY_TELEMETRY;
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  test("flush sends single event as array to telemetry endpoint", async () => {
    mock.module("./config.js", () => ({
      loadConfig: async () => ({ wallet: { type: "evm-private-key" } }),
    }));

    const { installTelemetry, flushTelemetry } = await import("./telemetry");
    const { Command } = await import("commander");
    const cli = new Command("use-agently");
    cli.addCommand(new Command("whoami").action(() => {}));
    installTelemetry(cli);

    await cli.parseAsync(["node", "use-agently", "whoami"]);
    await flushTelemetry();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.use-agently.com/telemetry");
    expect(options.method).toBe("POST");

    const body = JSON.parse(options.body as string);
    expect(body).toBeArray();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("whoami");
    expect(body[0].args.duration).toBeNumber();
    expect(body[0].session.os).toBe(process.platform);
    expect(body[0].session.arch).toBe(process.arch);
    expect(body[0].session.is_tty).toBeBoolean();
    expect(body[0].session.wallet).toBeNull();
  });

  test("flush is a no-op when no command was run", async () => {
    const { flushTelemetry } = await import("./telemetry");
    await flushTelemetry();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("flush swallows fetch errors", async () => {
    mock.module("./config.js", () => ({
      loadConfig: async () => ({ wallet: { type: "evm-private-key" } }),
    }));

    const { installTelemetry, flushTelemetry } = await import("./telemetry");
    fetchSpy.mockRejectedValueOnce(new Error("network error"));

    const { Command } = await import("commander");
    const cli = new Command("use-agently");
    cli.addCommand(new Command("whoami").action(() => {}));
    installTelemetry(cli);

    await cli.parseAsync(["node", "use-agently", "whoami"]);
    // Should not throw
    await flushTelemetry();
  });

  test("session reflects no wallet when config has none", async () => {
    mock.module("./config.js", () => ({
      loadConfig: async () => undefined,
    }));

    const { installTelemetry, flushTelemetry } = await import("./telemetry");
    const { Command } = await import("commander");
    const cli = new Command("use-agently");
    cli.addCommand(new Command("init").action(() => {}));
    installTelemetry(cli);

    await cli.parseAsync(["node", "use-agently", "init"]);
    await flushTelemetry();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body[0].session.wallet).toBeNull();
  });
});

describe("telemetry opt-out", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    delete process.env.USE_AGENTLY_TELEMETRY;
  });

  test("USE_AGENTLY_TELEMETRY=0 env var disables telemetry", async () => {
    process.env.USE_AGENTLY_TELEMETRY = "0";

    mock.module("./config.js", () => ({
      loadConfig: async () => ({ wallet: { type: "evm-private-key" } }),
    }));

    const { installTelemetry, flushTelemetry } = await import("./telemetry");
    const { Command } = await import("commander");
    const cli = new Command("use-agently");
    cli.addCommand(new Command("whoami").action(() => {}));
    installTelemetry(cli);

    await cli.parseAsync(["node", "use-agently", "whoami"]);
    await flushTelemetry();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("USE_AGENTLY_TELEMETRY=0 in config disables telemetry", async () => {
    process.env.USE_AGENTLY_TELEMETRY = "0";

    mock.module("./config.js", () => ({
      loadConfig: async () => ({
        wallet: { type: "evm-private-key" },
      }),
    }));

    const { installTelemetry, flushTelemetry } = await import("./telemetry");
    const { Command } = await import("commander");
    const cli = new Command("use-agently");
    cli.addCommand(new Command("whoami").action(() => {}));
    installTelemetry(cli);

    await cli.parseAsync(["node", "use-agently", "whoami"]);
    await flushTelemetry();

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
