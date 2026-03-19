import { Command } from "commander";
import { getOutputFormat, outputJsonCollection, outputNoResults, boldBlue, getMaxWidth, Table } from "../output";
import { search } from "@use-agently/sdk/agently";
import { defaultClient } from "../client";

export const searchCommand = new Command("search")
  .description("Search the Agently marketplace for agents")
  .option("-q, --query <text>", "Search query to filter agents by name or description")
  .option("-p, --protocol <protocols>", "Filter by protocol(s), comma-separated (e.g. a2a,mcp)")
  .showHelpAfterError(true)
  .addHelpText(
    "after",
    '\nExamples:\n  use-agently search\n  use-agently search -q "echo"\n  use-agently search --protocol a2a\n  use-agently search -q "assistant" --protocol "a2a,mcp"',
  )
  .action(async (options: { query?: string; protocol?: string }, command: Command) => {
    const format = getOutputFormat(command);
    const protocol = options.protocol ? options.protocol.split(",").map((p) => p.trim().toLowerCase()) : undefined;
    const result = await search(defaultClient, { q: options.query, protocol });
    const items = result.hits.map(({ id, name, description, protocols }) => ({ id, name, description, protocols }));

    if (items.length === 0) {
      outputNoResults(format);
      return;
    }

    if (format === "tui") {
      renderAgentsTable(items);
    } else {
      outputJsonCollection(items);
    }
  });

function formatId(id: string): string {
  const match = id.match(/^(.*?\/erc8004:)(0x[0-9a-fA-F]+)(\/\d+)$/);
  if (match) return `${match[1]}\n${match[2]}\n${match[3]}`;
  return id;
}

function renderAgentsTable(items: { id: string; name: string; description: string; protocols: string[] }[]): void {
  const maxWidth = getMaxWidth();

  const idSegmentWidth =
    Math.max(
      ...items.flatMap((item) =>
        formatId(item.id)
          .split("\n")
          .map((line) => line.length),
      ),
    ) + 2;
  const protoWidth = 12;
  const nameDescWidth = maxWidth - idSegmentWidth - protoWidth - 10;

  const table = new Table({
    wordWrap: true,
    wrapOnWordBoundary: true,
    colWidths: [idSegmentWidth, nameDescWidth, protoWidth],
    head: ["id", "agent (name & description)", "protocols"],
  });

  for (const item of items) {
    table.push([formatId(item.id), `${boldBlue(item.name)}\n${item.description}`, (item.protocols ?? []).join(", ")]);
  }

  console.log(table.toString());
}
