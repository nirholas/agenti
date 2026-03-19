import { Command } from "commander";
import { DryRunPaymentRequired } from "@use-agently/sdk";
import { resolveFetch, handleDryRunError } from "../client";
import { output } from "../output";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Commander accumulator for repeatable -H flags. */
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}

/** Parse raw "Key: Value" header strings into a record. Splits on the first colon only. */
export function parseHeaders(raw: string[]): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const h of raw) {
    const idx = h.indexOf(":");
    if (idx === -1) {
      throw new Error(`Invalid header "${h}". Expected "Key: Value" format (e.g. "Content-Type: application/json").`);
    }
    const key = h.slice(0, idx).trim();
    if (!key) {
      throw new Error(
        `Invalid header "${h}". Header name cannot be empty. Expected "Key: Value" format (e.g. "Content-Type: application/json").`,
      );
    }
    headers[key] = h.slice(idx + 1).trim();
  }
  return headers;
}

/**
 * Resolve the request body from -d / --data-raw.
 * Strings prefixed with "@" are read as file paths (curl-style).
 */
export async function resolveBody(data?: string): Promise<string | undefined> {
  if (data === undefined) return undefined;
  if (data.startsWith("@")) {
    const filePath = data.slice(1);
    if (!filePath) {
      throw new Error(
        'Empty file path after "@". Expected -d @<path> (e.g. -d @body.json), or pass the body inline: -d \'{"key":"value"}\'',
      );
    }
    try {
      return await Bun.file(filePath).text();
    } catch {
      throw new Error(
        `Could not read file "${filePath}" (from -d @${filePath}). Ensure the file exists and is readable, or pass the body inline: -d '{"key":"value"}'`,
      );
    }
  }
  return data;
}

/** Default maximum response size in bytes. */
const DEFAULT_MAX_SIZE = 100 * 1024 * 1024; // 100 MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Early rejection when Content-Length header advertises a body larger than maxSize. */
function checkContentLength(response: Response, maxSize: number): void {
  const cl = response.headers.get("content-length");
  if (cl) {
    const size = Number(cl);
    if (!Number.isNaN(size) && size > maxSize) {
      throw new Error(
        `Response too large: ${formatBytes(size)} exceeds --max-filesize limit of ${formatBytes(maxSize)}. ` +
          `Increase the limit with --max-filesize <bytes> (e.g. --max-filesize ${size}).`,
      );
    }
  }
}

/**
 * Stream the response body while enforcing a byte-size limit.
 * Protects against OOM when the server omits Content-Length (e.g. chunked responses).
 */
async function consumeBodyWithLimit(response: Response, maxSize: number): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);

  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxSize) {
        await reader.cancel();
        throw new Error(
          `Response body exceeded --max-filesize limit of ${formatBytes(maxSize)} while streaming. ` +
            `Increase the limit with --max-filesize <bytes>.`,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

/**
 * Stream the response body directly to a file while enforcing a byte-size limit.
 * Avoids buffering the entire response in memory for --output-file.
 */
async function streamBodyToFile(response: Response, filePath: string, maxSize: number): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    await Bun.write(filePath, Buffer.alloc(0));
    return;
  }

  const file = Bun.file(filePath);
  const writer = file.writer();
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxSize) {
        await reader.cancel();
        writer.end();
        throw new Error(
          `Response body exceeded --max-filesize limit of ${formatBytes(maxSize)} while streaming. ` +
            `Increase the limit with --max-filesize <bytes>.`,
        );
      }
      writer.write(value);
    }
    writer.end();
  } catch (err) {
    writer.end();
    throw err;
  } finally {
    reader.releaseLock();
  }
}

// ─── Core request execution ─────────────────────────────────────────────────

interface WebOptions {
  header: string[];
  data?: string;
  dataRaw?: string;
  outputFile?: string;
  location?: boolean;
  verbose?: boolean;
  include?: boolean;
  pay?: boolean;
  fail?: boolean;
  timeout?: string;
  maxFilesize?: string;
}

async function executeHttpRequest(method: string, url: string, options: WebOptions, command: Command): Promise<void> {
  const fetchImpl = await resolveFetch(options.pay);

  // Validate URL — only http(s) to prevent file:// exfiltration in agent contexts
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL "${url}". Expected a full URL (e.g. https://api.example.com/data).`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `Unsupported URL scheme "${parsed.protocol}". Only http: and https: are supported (e.g. https://api.example.com/data).`,
    );
  }

  if (options.data !== undefined && options.dataRaw !== undefined) {
    throw new Error(
      "Cannot use both -d/--data and --data-raw. Use -d to read from a file with @, or --data-raw to send the value as-is.",
    );
  }

  const headers = parseHeaders(options.header);
  const body = options.dataRaw !== undefined ? options.dataRaw : await resolveBody(options.data);

  const timeoutMs = options.timeout ? Number(options.timeout) : 30_000;
  if (Number.isNaN(timeoutMs) || timeoutMs <= 0) {
    throw new Error(
      `Invalid timeout "${options.timeout}". Expected a positive number in milliseconds (e.g. --timeout 5000).`,
    );
  }
  const maxSize = options.maxFilesize ? Number(options.maxFilesize) : DEFAULT_MAX_SIZE;
  if (Number.isNaN(maxSize) || maxSize <= 0) {
    throw new Error(
      `Invalid --max-filesize "${options.maxFilesize}". Expected a positive number in bytes (e.g. --max-filesize 10485760 for 10 MB).`,
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const init: RequestInit = {
    method: method.toUpperCase(),
    headers,
    body,
    redirect: options.location ? "follow" : "manual",
    signal: controller.signal,
  };

  if (options.verbose) {
    console.error(`> ${method.toUpperCase()} ${url}`);
    for (const [k, v] of Object.entries(headers)) {
      console.error(`> ${k}: ${v}`);
    }
    console.error(">");
  }

  try {
    const response = await fetchImpl(url, init);

    // Check Content-Length before consuming body (fast path for known-large responses)
    checkContentLength(response, maxSize);

    if (options.verbose) {
      console.error(`< ${response.status} ${response.statusText}`);
      response.headers.forEach((v, k) => {
        console.error(`< ${k}: ${v}`);
      });
      console.error("<");
    }

    // --output-file: stream directly to disk to avoid buffering large responses in memory.
    // Timer stays active so the timeout covers both headers AND body transfer.
    if (options.outputFile) {
      try {
        await streamBodyToFile(response, options.outputFile, maxSize);
      } catch (e) {
        // Re-throw max-filesize errors as-is
        if (e instanceof Error && e.message.includes("--max-filesize")) throw e;
        throw new Error(
          `Could not write to "${options.outputFile}": ${e instanceof Error ? e.message : e}. Ensure the directory exists and is writable.`,
        );
      }
      clearTimeout(timer);
      console.log(`Response body written to ${options.outputFile} (HTTP ${response.status})`);
      if (options.fail && !response.ok) process.exit(1);
      return;
    }

    // Stream body with size limit — protects against OOM for chunked responses too.
    const bodyBuf = await consumeBodyWithLimit(response, maxSize);
    clearTimeout(timer);

    const responseBody = bodyBuf.toString("utf-8");

    // --output json: structured JSON to stdout
    if (command.optsWithGlobals().output === "json") {
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((v, k) => {
        responseHeaders[k] = v;
      });
      output(command, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
      });
      if (options.fail && !response.ok) process.exit(1);
      return;
    }

    // -i / --include: status + headers + body
    if (options.include) {
      let headerBlock = `HTTP ${response.status} ${response.statusText}\n`;
      response.headers.forEach((v, k) => {
        headerBlock += `${k}: ${v}\n`;
      });
      console.log(headerBlock + "\n" + responseBody);
      if (options.fail && !response.ok) process.exit(1);
      return;
    }

    // Default: body only
    console.log(responseBody);
    if (options.fail && !response.ok) process.exit(1);
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof DryRunPaymentRequired) {
      handleDryRunError(err);
    }
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms. Use --timeout <ms> to increase the limit.`);
    }
    throw err;
  }
}

// ─── Command registration ───────────────────────────────────────────────────

function addSharedOptions(cmd: Command, hasBody: boolean): Command {
  cmd
    .option("-H, --header <value>", 'Request header, repeatable (e.g. "Content-Type: application/json")', collect, [])
    .option("--output-file <path>", "Save response body to file")
    .option("-L, --location", "Follow redirects")
    .option("-v, --verbose", "Show request/response headers on stderr")
    .option("-i, --include", "Include response status and headers in stdout output")
    .option("--timeout <ms>", "Request timeout in milliseconds (default: 30000)")
    .option("--max-filesize <bytes>", "Maximum response size in bytes (default: 104857600 / 100 MB)")
    .option("--pay", "Authorize x402 payment (default: dry-run, shows cost only)")
    .option("--fail", "Exit with code 1 on HTTP error responses (4xx/5xx)");

  if (hasBody) {
    cmd
      .option("-d, --data <body>", "Request body (prefix @ to read from file, e.g. @body.json)")
      .option("--data-raw <body>", "Request body sent as-is (@ is not treated as a file reference)");
  }

  return cmd;
}

function createMethodSubcommand(method: string, description: string, hasBody: boolean): Command {
  const cmd = new Command(method)
    .description(description)
    .argument("<url>", "Full URL to request (e.g. https://api.example.com/data)")
    .showHelpAfterError(true);

  addSharedOptions(cmd, hasBody);

  const bodyExample = hasBody ? ' -d \'{"key":"value"}\' -H "Content-Type: application/json"' : "";
  cmd.addHelpText("after", `\nExamples:\n  use-agently web ${method} https://api.example.com/data${bodyExample} -v`);

  cmd.action(async (url: string, options: WebOptions, command: Command) => {
    await executeHttpRequest(method, url, options, command);
  });

  return cmd;
}

export const webCommand = new Command("web")
  .description("Make HTTP requests with x402 payment support")
  .action(function () {
    (this as Command).outputHelp();
  });

webCommand.addCommand(createMethodSubcommand("get", "Make an HTTP GET request", false));
webCommand.addCommand(createMethodSubcommand("post", "Make an HTTP POST request", true));
webCommand.addCommand(createMethodSubcommand("put", "Make an HTTP PUT request", true));
webCommand.addCommand(createMethodSubcommand("patch", "Make an HTTP PATCH request", true));
webCommand.addCommand(createMethodSubcommand("delete", "Make an HTTP DELETE request", false));
