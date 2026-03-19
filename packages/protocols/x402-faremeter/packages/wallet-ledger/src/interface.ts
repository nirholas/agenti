import type { UserInterface } from "./types";

/**
 * Arguments for creating a readline-based user interface.
 */
export type createReadlineInterfaceArgs = {
  /** Input stream (typically process.stdin). */
  stdin: NodeJS.ReadableStream;
  /** Output stream (typically process.stdout). */
  stdout: NodeJS.WritableStream;
};

/**
 * Creates a readline-based user interface for Ledger interactions.
 *
 * Provides a simple terminal interface for displaying messages and
 * prompting for user input during account selection.
 *
 * @param args - Input and output streams for the readline interface.
 * @returns A UserInterface implementation using Node.js readline.
 */
export async function createReadlineInterface(
  args: createReadlineInterfaceArgs,
) {
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: args.stdin,
    output: args.stdout,
  });

  return {
    message: (msg: string) => void args.stdout.write(msg + "\n"),
    question: async (q: string) =>
      new Promise<string>((resolve) => {
        rl.question(q, resolve);
      }),
    close: async () => rl.close(),
  } satisfies UserInterface;
}
