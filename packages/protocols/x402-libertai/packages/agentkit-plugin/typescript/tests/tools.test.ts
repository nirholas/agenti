import type { Action } from "@coinbase/agentkit";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { actionsToTools } from "../src/tools.js";

function makeAction(
  name: string,
  description: string,
  schema: z.ZodObject<z.ZodRawShape>,
  handler: Action["invoke"],
): Action {
  return { name, description, schema, invoke: handler } as Action;
}

describe("actionsToTools", () => {
  const echoAction = makeAction(
    "echo",
    "Echoes input",
    z.object({ message: z.string() }),
    async (args) => `echo: ${(args as { message: string }).message}`,
  );

  const failAction = makeAction(
    "fail",
    "Always fails",
    z.object({}),
    async () => {
      throw new Error("boom");
    },
  );

  it("converts actions to ChatCompletionTool format", () => {
    const { tools } = actionsToTools([echoAction]);

    expect(tools).toHaveLength(1);
    expect(tools[0].type).toBe("function");
    expect(tools[0].function.name).toBe("echo");
    expect(tools[0].function.description).toBe("Echoes input");
    expect(tools[0].function.parameters).toBeDefined();
  });

  it("includes JSON schema for parameters", () => {
    const { tools } = actionsToTools([echoAction]);
    const params = tools[0].function.parameters as Record<string, unknown>;

    expect(params).toHaveProperty("properties");
    expect(params.properties).toHaveProperty("message");
  });

  it("handles multiple actions", () => {
    const { tools } = actionsToTools([echoAction, failAction]);
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.function.name)).toEqual(["echo", "fail"]);
  });

  it("returns empty array for no actions", () => {
    const { tools } = actionsToTools([]);
    expect(tools).toEqual([]);
  });

  describe("executeTool", () => {
    it("dispatches to correct handler", async () => {
      const { executeTool } = actionsToTools([echoAction]);
      const result = await executeTool(
        "echo",
        JSON.stringify({ message: "hello" }),
      );
      expect(result).toBe("echo: hello");
    });

    it("returns error for unknown tool", async () => {
      const { executeTool } = actionsToTools([echoAction]);
      const result = await executeTool("nope", "{}");
      expect(result).toContain('unknown tool "nope"');
    });

    it("catches handler errors", async () => {
      const { executeTool } = actionsToTools([failAction]);
      const result = await executeTool("fail", "{}");
      expect(result).toContain("Error executing fail");
      expect(result).toContain("boom");
    });

    it("catches invalid JSON", async () => {
      const { executeTool } = actionsToTools([echoAction]);
      const result = await executeTool("echo", "not-json");
      expect(result).toContain("Error executing echo");
    });
  });
});
