import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { captureOutput } from "../testing";

const mockReadFile = mock(async (_path: string, _encoding: unknown) => JSON.stringify({}));
const mockWriteFile = mock(async (_path: string, _data: string, _encoding?: unknown) => {});
const mockMkdir = mock(async () => {});
const mockLoadConfig = mock(async () => undefined as unknown);

mock.module("node:fs/promises", () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
  rename: mock(async () => {}),
}));

mock.module("../config.js", () => ({
  loadConfig: mockLoadConfig,
  saveConfig: async () => {},
  backupConfig: async () => "",
  getConfigOrThrow: async () => {
    throw new Error("No wallet configured.");
  },
}));

mock.module("node:child_process", () => ({
  execSync: mock(() => {}),
}));

const { cli } = await import("../cli");
const { CURRENT_VERSION, checkAutoUpdate } = await import("./update");
const updateModule = await import("./update");

describe("update command", () => {
  const out = captureOutput();
  let fetchSpy: ReturnType<typeof spyOn>;
  let exitSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    mockReadFile.mockClear();
    mockWriteFile.mockClear();
    mockMkdir.mockClear();
    mockReadFile.mockImplementation(async () => JSON.stringify({}));
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ version: "9.9.9" }),
    } as Response);
    exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    exitSpy.mockRestore();
  });

  test("json output - update available", async () => {
    await cli.parseAsync(["test", "use-agently", "-o", "json", "update"]);

    expect(out.json).toEqual({
      current: CURRENT_VERSION,
      latest: "9.9.9",
      updated: true,
    });
  });

  test("no update when already on latest", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ version: CURRENT_VERSION }),
    } as Response);

    await cli.parseAsync(["test", "use-agently", "-o", "json", "update"]);

    expect(out.json).toEqual({
      current: CURRENT_VERSION,
      latest: CURRENT_VERSION,
      updated: false,
    });
  });

  test("saves lastUpdateCheck after update", async () => {
    await cli.parseAsync(["test", "use-agently", "update"]);

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const written = JSON.parse(mockWriteFile.mock.calls[0][1] as string);
    expect(typeof written.lastUpdateCheck).toBe("string");
  });

  test("exits with 1 on registry error", async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 503 } as Response);

    try {
      await cli.parseAsync(["test", "use-agently", "update"]);
    } catch {
      // expected: process.exit throws
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe("checkAutoUpdate", () => {
  let fetchSpy: ReturnType<typeof spyOn>;
  let devVersionSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    mockReadFile.mockClear();
    mockWriteFile.mockClear();
    mockMkdir.mockClear();
    mockLoadConfig.mockImplementation(async () => undefined);
    mockReadFile.mockImplementation(async () => {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });
    fetchSpy = spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ version: "9.9.9" }),
    } as Response);
    devVersionSpy = spyOn(updateModule, "isDevVersion").mockReturnValue(false);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    devVersionSpy.mockRestore();
  });

  test("skips update check when checked within 24h", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify({ lastUpdateCheck: new Date().toISOString() }));

    await checkAutoUpdate();

    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  test("runs update check when last check was >24h ago", async () => {
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    mockReadFile.mockResolvedValue(JSON.stringify({ lastUpdateCheck: yesterday }));

    await checkAutoUpdate();

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });

  test("runs update check when no prior check recorded", async () => {
    await checkAutoUpdate();

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });

  test("skips when USE_AGENTLY_AUTO_UPDATE is 0 in config", async () => {
    mockLoadConfig.mockImplementation(async () => ({ env: { USE_AGENTLY_AUTO_UPDATE: 0 } }));

    await checkAutoUpdate();

    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("runs when USE_AGENTLY_AUTO_UPDATE is 1 in config", async () => {
    mockLoadConfig.mockImplementation(async () => ({ env: { USE_AGENTLY_AUTO_UPDATE: 1 } }));

    await checkAutoUpdate();

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });

  test("logs warning but does not throw on errors", async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 500 } as Response);
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});

    await expect(checkAutoUpdate()).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith("Auto-update failed:", expect.any(String));
    warnSpy.mockRestore();
  });
});
