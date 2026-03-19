import { simulateReadableStream, stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";
import { lastUserText } from "./_utils";

const echoTenTimesModel = {
  specificationVersion: "v3" as const,
  provider: "echo",
  modelId: "echo-10",
  supportedUrls: {},
  doGenerate(options: { prompt: Array<{ role: string; content: Array<{ type: string; text?: string }> }> }) {
    const text = lastUserText(options.prompt);
    return Promise.resolve({
      content: [{ type: "text" as const, text: Array(10).fill(text).join("\n") }],
      finishReason: "stop" as const,
      usage: {
        inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 0, text: 0, reasoning: 0 },
      },
      warnings: [],
    });
  },
  doStream(options: { prompt: Array<{ role: string; content: Array<{ type: string; text?: string }> }> }) {
    const text = lastUserText(options.prompt);
    const stream = simulateReadableStream({
      chunkDelayInMs: 200,
      chunks: [
        { type: "stream-start" as const, warnings: [] },
        { type: "text-start" as const, id: "1" },
        ...Array.from({ length: 10 }, (_, i) => ({
          type: "text-delta" as const,
          id: "1",
          delta: i === 0 ? text : "\n" + text,
        })),
        { type: "text-end" as const, id: "1" },
        {
          type: "finish" as const,
          finishReason: "stop" as const,
          usage: {
            inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 0, text: 0, reasoning: 0 },
          },
        },
      ],
    });
    return Promise.resolve({ stream });
  },
};

export const accepts: Accepts = { scheme: "free" };

export default new ToolLoopAgent({
  model: echoTenTimesModel,
  stopWhen: stepCountIs(1),
});
