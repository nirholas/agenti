import type { Action } from "@coinbase/agentkit";
import type { ChatCompletionTool } from "openai/resources";
import { zodToJsonSchema } from "zod-to-json-schema";

export function actionsToTools(actions: Action[]): {
  tools: ChatCompletionTool[];
  executeTool: (name: string, argsJson: string) => Promise<string>;
} {
  const actionMap = new Map<string, Action["invoke"]>();

  const tools: ChatCompletionTool[] = actions.map((action) => {
    actionMap.set(action.name, action.invoke);
    return {
      type: "function" as const,
      function: {
        name: action.name,
        description: action.description,
        parameters: zodToJsonSchema(action.schema, {
          target: "openApi3",
        }) as Record<string, unknown>,
      },
    };
  });

  const executeTool = async (
    name: string,
    argsJson: string,
  ): Promise<string> => {
    const handler = actionMap.get(name);
    if (!handler) {
      return `Error: unknown tool "${name}"`;
    }
    try {
      const args = JSON.parse(argsJson);
      return await handler(args);
    } catch (err) {
      return `Error executing ${name}: ${err instanceof Error ? err.message : String(err)}`;
    }
  };

  return { tools, executeTool };
}
