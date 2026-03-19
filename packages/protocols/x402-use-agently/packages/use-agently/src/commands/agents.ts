import { Command } from "commander";
import { getOutputFormat, outputJsonCollection, outputNoResults, boldBlue, getMaxWidth, Table } from "../output";
import { search } from "@use-agently/sdk/agently";
import { defaultClient } from "../client";

/**
 * I think we should deprecate this command
 */
export const agentsCommand = new Command("agents")
  .description("List available agents on Agently")
  .action(async (_options: Record<string, never>, command: Command) => {
    const format = getOutputFormat(command);
    const result = await search(defaultClient);
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
