/** Argument parsing for the agenti-gateway CLI. */

/** Splits a command line on whitespace, honoring single and double quotes. */
export function splitCommand(command: string): string[] {
  const parts: string[] = []
  let current = ''
  let quote: '"' | "'" | undefined
  let started = false
  for (const char of command) {
    if (quote) {
      if (char === quote) quote = undefined
      else current += char
    } else if (char === '"' || char === "'") {
      quote = char
      started = true
    } else if (/\s/.test(char)) {
      if (started || current) parts.push(current)
      current = ''
      started = false
    } else {
      current += char
      started = true
    }
  }
  if (quote) throw new Error(`Unterminated ${quote} in command: ${command}`)
  if (started || current) parts.push(current)
  return parts
}

/** Parses repeated `tool=$price` flags into a price table. */
export function parsePrices(entries: string[]): Record<string, string> {
  const prices: Record<string, string> = {}
  for (const entry of entries) {
    const at = entry.lastIndexOf('=')
    if (at <= 0 || at === entry.length - 1) throw new Error(`--price expects tool=$price, got "${entry}"`)
    prices[entry.slice(0, at)] = entry.slice(at + 1)
  }
  return prices
}
