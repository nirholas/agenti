import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { output, outputCollection } from "./output";

describe("output", () => {
  let logSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    logSpy = spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  test("json output emits JSON string", () => {
    const cmd = { optsWithGlobals: () => ({ output: "json" }) } as any;
    output(cmd, { name: "test" });
    expect(logSpy.mock.calls[0][0]).toBe('{"name":"test"}');
  });

  test("tui output renders key-value table for objects", () => {
    const cmd = { optsWithGlobals: () => ({ output: "tui" }) } as any;
    output(cmd, { namespace: "eip155", address: "0x1234" });
    const rendered = logSpy.mock.calls[0][0] as string;
    expect(rendered).toContain("Namespace");
    expect(rendered).toContain("eip155");
    expect(rendered).toContain("Address");
    expect(rendered).toContain("0x1234");
    // cli-table3 draws borders
    expect(rendered).toContain("─");
    expect(rendered).toContain("│");
  });

  test("tui output passes strings through directly", () => {
    const cmd = { optsWithGlobals: () => ({ output: "tui" }) } as any;
    output(cmd, "hello world");
    expect(logSpy.mock.calls[0][0]).toBe("hello world");
  });
});

describe("outputCollection", () => {
  let logSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    logSpy = spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  test("json output emits NDJSON", () => {
    const cmd = { optsWithGlobals: () => ({ output: "json" }) } as any;
    outputCollection(cmd, [{ a: 1 }, { b: 2 }]);
    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy.mock.calls[0][0]).toBe('{"a":1}');
    expect(logSpy.mock.calls[1][0]).toBe('{"b":2}');
  });

  test("tui output renders collection table", () => {
    const cmd = { optsWithGlobals: () => ({ output: "tui" }) } as any;
    outputCollection(cmd, [
      { id: "eip155:1/erc8004:0x1234/1", name: "Agent A", description: "First agent" },
      { id: "eip155:1/erc8004:0x1234/2", name: "Agent B", description: "Second agent" },
    ]);
    const rendered = logSpy.mock.calls[0][0] as string;
    expect(rendered).toContain("Agent A");
    expect(rendered).toContain("Agent B");
    expect(rendered).toContain("First agent");
    expect(rendered).toContain("─");
  });

  test("tui output renders boxen to stderr for empty list", () => {
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});
    const cmd = { optsWithGlobals: () => ({ output: "tui" }) } as any;
    outputCollection(cmd, []);
    const rendered = errorSpy.mock.calls[0][0] as string;
    expect(rendered).toContain("No results found.");
    expect(rendered).toMatch(/[╭╰]/);
    expect(logSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test("json output writes to stderr for empty list", () => {
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});
    const cmd = { optsWithGlobals: () => ({ output: "json" }) } as any;
    outputCollection(cmd, []);
    expect(errorSpy.mock.calls[0][0]).toBe("No results found.");
    expect(logSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
