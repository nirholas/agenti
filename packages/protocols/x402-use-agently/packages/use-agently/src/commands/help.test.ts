import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";

const { cli } = await import("../cli");

describe("help command", () => {
  let writeSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    writeSpy = spyOn(process.stdout, "write").mockImplementation((..._args: any[]) => true);
    exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
  });

  afterEach(() => {
    writeSpy.mockRestore();
    exitSpy.mockRestore();
  });

  test("use-agently --help prints available commands", async () => {
    try {
      await cli.parseAsync(["test", "use-agently", "--help"]);
    } catch {
      // expected: --help calls process.exit(0)
    }

    const output = writeSpy.mock.calls.map((c: unknown[]) => c[0]).join("");
    expect(output).toContain("use-agently");
    expect(output).toContain("Diagnostics");
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  test("use-agently (no args) prints available commands", async () => {
    await cli.parseAsync(["test", "use-agently"]);

    const output = writeSpy.mock.calls.map((c: unknown[]) => c[0]).join("");
    expect(output).toContain("use-agently");
    expect(output).toContain("Diagnostics");
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test("use-agently <unknown-command> shows unknown command error", async () => {
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation((..._args: any[]) => true);

    try {
      await cli.parseAsync(["test", "use-agently", "upgrade"]);
    } catch {
      // expected: unknown command calls process.exit(1)
    }

    const errOutput = stderrSpy.mock.calls.map((c: unknown[]) => c[0]).join("");
    stderrSpy.mockRestore();

    expect(errOutput).toContain("error: unknown command 'upgrade'");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe("global options in subcommand help", () => {
  let writeSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    writeSpy = spyOn(process.stdout, "write").mockImplementation((..._args: any[]) => true);
    exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
  });

  afterEach(() => {
    writeSpy.mockRestore();
    exitSpy.mockRestore();
  });

  const subcommands = [
    ["a2a", "send"],
    ["a2a", "card"],
    ["mcp", "tools"],
    ["mcp", "call"],
    ["web", "get"],
    ["web", "post"],
    ["web", "put"],
    ["web", "patch"],
    ["web", "delete"],
  ];

  for (const args of subcommands) {
    const label = args.join(" ");

    test(`${label} --help includes Global Options section`, async () => {
      try {
        await cli.parseAsync(["test", "use-agently", ...args, "--help"]);
      } catch {
        // expected: --help calls process.exit(0)
      }

      const output = writeSpy.mock.calls.map((c: unknown[]) => c[0]).join("");
      expect(output).toContain("Global Options");
    });

    test(`${label} --help includes -o, --output global option`, async () => {
      try {
        await cli.parseAsync(["test", "use-agently", ...args, "--help"]);
      } catch {
        // expected: --help calls process.exit(0)
      }

      const output = writeSpy.mock.calls.map((c: unknown[]) => c[0]).join("");
      expect(output).toContain("-o, --output");
    });
  }
});
