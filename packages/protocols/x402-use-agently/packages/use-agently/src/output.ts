import { Command } from "commander";
import Table from "cli-table3";
import boxen from "boxen";

export type OutputFormat = "json" | "tui";

export function getOutputFormat(command: Command): OutputFormat {
  return command.optsWithGlobals().output ?? "tui";
}

/** Resolve output format with a safe fallback for early failures (defaults to tui). */
export function resolveOutputFormat(command: Command): OutputFormat {
  try {
    return getOutputFormat(command);
  } catch (err) {
    console.warn(
      "Falling back to TUI output after failing to resolve --output option:",
      err instanceof Error ? err.message : String(err),
    );
    return "tui";
  }
}

/** Available width: use terminal columns if known, otherwise default to 120 (minimum 120). */
export function getMaxWidth(): number {
  return Math.max(process.stdout.columns || 80, 120);
}

export function stringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function boldBlue(s: string): string {
  return `\x1b[1m\x1b[34m${s}\x1b[0m`;
}

export { Table, boxen };

// --- JSON output helpers ---

export function outputJson(data: unknown): void {
  console.log(JSON.stringify(data));
}

export function outputJsonCollection(items: unknown[]): void {
  for (const item of items) {
    console.log(JSON.stringify(item));
  }
}

// --- TUI output helpers ---

function formatNamedItem(item: Record<string, unknown>): string {
  const rest = Object.entries(item).filter(([k, v]) => k !== "name" && v !== undefined);
  if (rest.length === 1) return stringify(rest[0][1]);
  return rest.map(([k, v]) => `${k}: ${stringify(v)}`).join(", ");
}

function flattenEntries(data: Record<string, unknown>, prefix = ""): [string, string][] {
  const result: [string, string][] = [];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (item && typeof item === "object" && !Array.isArray(item) && "name" in item) {
          result.push([String(item.name), formatNamedItem(item as Record<string, unknown>)]);
        } else if (item && typeof item === "object" && !Array.isArray(item)) {
          result.push(...flattenEntries(item as Record<string, unknown>, `${fullKey}[${i}]`));
        } else {
          result.push([`${fullKey}[${i}]`, stringify(item)]);
        }
      }
    } else if (value && typeof value === "object") {
      result.push(...flattenEntries(value as Record<string, unknown>, fullKey));
    } else {
      result.push([fullKey, stringify(value)]);
    }
  }
  return result;
}

export function outputTuiKeyValue(data: Record<string, unknown>): void {
  const maxWidth = getMaxWidth();
  const stringified = flattenEntries(data);
  const keyWidth = Math.max(...stringified.map(([k]) => k.length)) + 2;
  const naturalWidth = stringified.reduce((max, [k, v]) => Math.max(max, k.length + v.length + 5), 0);

  const options: Table.TableConstructorOptions = { wordWrap: true, wrapOnWordBoundary: true };
  if (naturalWidth > maxWidth) {
    options.colWidths = [keyWidth, maxWidth - keyWidth - 3];
  }

  const table = new Table(options);
  for (const [key, value] of stringified) {
    table.push({ [boldBlue(capitalize(key))]: [value] });
  }
  console.log(table.toString());
}

export function outputNoResults(format: OutputFormat): void {
  if (format === "json") {
    console.error("No results found.");
  } else {
    console.error(
      boxen("No results found.", { padding: { top: 0, bottom: 0, left: 1, right: 1 }, borderStyle: "round" }),
    );
  }
}

// --- Convenience wrappers (for commands that don't need custom TUI) ---

export function output(command: Command, data: unknown): void {
  const format = getOutputFormat(command);
  if (format === "json") {
    outputJson(data);
  } else if (typeof data === "string") {
    console.log(data);
  } else if (data && typeof data === "object" && !Array.isArray(data)) {
    outputTuiKeyValue(data as Record<string, unknown>);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

export function outputCollection(command: Command, items: unknown[]): void {
  const format = getOutputFormat(command);
  if (items.length === 0) {
    outputNoResults(format);
    return;
  }
  if (format === "json") {
    outputJsonCollection(items);
  } else {
    // Generic fallback table — commands should override for custom TUI
    const keys = Object.keys((items as Record<string, unknown>[])[0]);
    const rows = (items as Record<string, unknown>[]).map((item) => keys.map((k) => stringify(item[k] ?? "")));

    const maxWidth = getMaxWidth();
    const naturalWidth = rows.reduce((max, row) => {
      const rowWidth = row.reduce((sum, cell) => sum + cell.length, 0) + keys.length * 3 + 1;
      return Math.max(max, rowWidth);
    }, 0);

    const options: Table.TableConstructorOptions = { head: keys, wordWrap: true, wrapOnWordBoundary: true };
    if (naturalWidth > maxWidth) {
      const colWidth = Math.floor((maxWidth - 1) / keys.length) - 2;
      options.colWidths = keys.map(() => colWidth);
    }

    const table = new Table(options);
    for (const row of rows) {
      table.push(row);
    }
    console.log(table.toString());
  }
}
