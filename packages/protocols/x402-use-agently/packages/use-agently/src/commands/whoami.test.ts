import { describe, expect, test } from "bun:test";
import { captureOutput, mockConfigModule, TEST_ADDRESS } from "../testing";

mockConfigModule();

const { cli } = await import("../cli");

describe("whoami command", () => {
  const out = captureOutput();

  test("json output", async () => {
    await cli.parseAsync(["test", "use-agently", "-o", "json", "whoami"]);

    expect(out.json).toEqual({
      namespace: "eip155",
      address: TEST_ADDRESS,
    });
  });

  test("tui output renders a table containing the data", async () => {
    await cli.parseAsync(["test", "use-agently", "-o", "tui", "whoami"]);

    const rendered = out.stdout;
    expect(rendered).toContain("Namespace");
    expect(rendered).toContain("eip155");
    expect(rendered).toContain("Address");
    expect(rendered).toContain(TEST_ADDRESS);
    expect(rendered).toContain("─");
  });
});
