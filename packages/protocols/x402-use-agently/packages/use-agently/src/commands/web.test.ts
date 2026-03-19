import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseHeaders, resolveBody } from "./web";
import {
  captureOutput,
  mockConfigModule,
  startX402FacilitatorLocal,
  stopX402FacilitatorLocal,
  TEST_ADDRESS,
  TEST_PRIVATE_KEY,
  testWalletConfig,
  type X402FacilitatorLocal,
} from "../testing";
import { createPaymentFetch, createDryRunFetch } from "../client";
import { EvmPrivateKeyWallet, DryRunPaymentRequired } from "@use-agently/sdk";

mockConfigModule();

const { cli } = await import("../cli");

describe("parseHeaders", () => {
  test("parses valid headers", () => {
    const result = parseHeaders(["Content-Type: application/json", "Authorization: Bearer tok123"]);
    expect(result).toStrictEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer tok123",
    });
  });

  test("handles header values containing colons", () => {
    const result = parseHeaders(["X-Custom: value:with:colons"]);
    expect(result).toStrictEqual({ "X-Custom": "value:with:colons" });
  });

  test("throws on missing colon", () => {
    expect(() => parseHeaders(["InvalidHeader"])).toThrow('Invalid header "InvalidHeader"');
  });

  test("throws on empty header name", () => {
    expect(() => parseHeaders([": value"])).toThrow("Header name cannot be empty");
  });
});

describe("resolveBody", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "web-test-"));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  test("returns undefined when no data", async () => {
    expect(await resolveBody(undefined)).toBeUndefined();
  });

  test("returns plain string as-is", async () => {
    expect(await resolveBody('{"key":"value"}')).toBe('{"key":"value"}');
  });

  test("reads file content with @ prefix", async () => {
    const filePath = join(tmpDir, "body.json");
    await Bun.write(filePath, '{"from":"file"}');
    expect(await resolveBody(`@${filePath}`)).toBe('{"from":"file"}');
  });

  test("throws actionable error for nonexistent @file", async () => {
    await expect(resolveBody("@/no/such/file.json")).rejects.toThrow("Could not read file");
  });

  test("throws on bare @ with no path", async () => {
    await expect(resolveBody("@")).rejects.toThrow('Empty file path after "@"');
  });
});

describe("web command cli", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("help", () => {
    let writeSpy: ReturnType<typeof spyOn>;
    let exitSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
      writeSpy = spyOn(process.stdout, "write").mockImplementation((..._args: any[]) => true);
      exitSpy = spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit");
      });
    });

    afterEach(() => {
      writeSpy.mockRestore();
      exitSpy.mockRestore();
    });

    test("use-agently web prints help with subcommands", async () => {
      await cli.parseAsync(["test", "use-agently", "web"]);
      const helpOutput = writeSpy.mock.calls.map((c: unknown[]) => c[0]).join("");
      expect(helpOutput).toContain("get");
      expect(helpOutput).toContain("post");
      expect(helpOutput).toContain("put");
      expect(helpOutput).toContain("patch");
      expect(helpOutput).toContain("delete");
    });
  });

  describe("basic requests (mocked fetch)", () => {
    const out = captureOutput();

    test("GET request prints response body", async () => {
      fetchSpy.mockImplementation(async () => new Response("hello world", { status: 200, statusText: "OK" }));

      await cli.parseAsync(["test", "use-agently", "web", "get", "http://example.com/test"]);
      expect(out.stdout).toContain("hello world");
    });

    test("POST with -d sends body", async () => {
      fetchSpy.mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = init?.body as string;
        return new Response(`received: ${body}`, { status: 200, statusText: "OK" });
      });

      await cli.parseAsync([
        "test",
        "use-agently",
        "-o",
        "tui",
        "web",
        "post",
        "http://example.com/data",
        "-d",
        '{"test":1}',
      ]);
      expect(out.stdout).toContain('received: {"test":1}');
    });

    test("POST with --data-raw sends body without interpreting @", async () => {
      fetchSpy.mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const body = init?.body as string;
        return new Response(`received: ${body}`, { status: 200, statusText: "OK" });
      });

      await cli.parseAsync([
        "test",
        "use-agently",
        "web",
        "post",
        "http://example.com/data",
        "--data-raw",
        "@not-a-file.json",
      ]);
      expect(out.stdout).toContain("received: @not-a-file.json");
    });

    test("errors when both -d and --data-raw are provided", async () => {
      await expect(
        cli.parseAsync([
          "test",
          "use-agently",
          "web",
          "post",
          "http://example.com/data",
          "-d",
          '{"a":1}',
          "--data-raw",
          '{"b":2}',
        ]),
      ).rejects.toThrow("Cannot use both");
    });

    test("-H passes headers to fetch", async () => {
      let capturedHeaders: HeadersInit | undefined;
      fetchSpy.mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        capturedHeaders = init?.headers;
        return new Response("ok", { status: 200, statusText: "OK" });
      });

      await cli.parseAsync([
        "test",
        "use-agently",
        "web",
        "get",
        "http://example.com/h",
        "-H",
        "X-Custom: myvalue",
        "-H",
        "Accept: text/plain",
      ]);
      // clientFetch normalizes headers to a Headers instance before passing to fetch
      expect(capturedHeaders).toBeInstanceOf(Headers);
      expect((capturedHeaders as Headers).get("X-Custom")).toBe("myvalue");
      expect((capturedHeaders as Headers).get("Accept")).toBe("text/plain");
    });

    test("-i includes status and headers in output", async () => {
      fetchSpy.mockImplementation(
        async () =>
          new Response("body content", {
            status: 200,
            statusText: "OK",
            headers: { "X-Test": "val" },
          }),
      );

      await cli.parseAsync(["test", "use-agently", "-o", "tui", "web", "get", "http://example.com/i", "-i"]);
      expect(out.stdout).toContain("HTTP 200 OK");
      expect(out.stdout).toContain("x-test: val");
      expect(out.stdout).toContain("body content");
    });

    test("-v prints request/response headers to stderr", async () => {
      fetchSpy.mockImplementation(
        async () =>
          new Response("ok", {
            status: 200,
            statusText: "OK",
            headers: { "X-Resp": "header" },
          }),
      );

      await cli.parseAsync(["test", "use-agently", "web", "get", "http://example.com/v", "-v"]);
      expect(out.errorSpy.mock.calls.map((c: unknown[]) => c[0]).join("\n")).toContain("> GET http://example.com/v");
      expect(out.errorSpy.mock.calls.map((c: unknown[]) => c[0]).join("\n")).toContain("< 200 OK");
    });

    test("--output json returns structured JSON", async () => {
      fetchSpy.mockImplementation(
        async () =>
          new Response("json body", {
            status: 201,
            statusText: "Created",
            headers: { "Content-Type": "text/plain" },
          }),
      );

      await cli.parseAsync(["test", "use-agently", "-o", "json", "web", "get", "http://example.com/json"]);
      const result = out.json as Record<string, unknown>;
      expect(result.status).toBe(201);
      expect(result.statusText).toBe("Created");
      expect(result.body).toBe("json body");
      expect((result.headers as Record<string, string>)["content-type"]).toBe("text/plain");
    });
  });

  describe("--output-file", () => {
    const out = captureOutput();
    let tmpDir: string;

    beforeAll(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), "web-outfile-"));
    });

    afterAll(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    test("writes response body to file", async () => {
      fetchSpy.mockImplementation(async () => new Response("file content", { status: 200, statusText: "OK" }));
      const outPath = join(tmpDir, "out.txt");

      await cli.parseAsync(["test", "use-agently", "web", "get", "http://example.com/f", "--output-file", outPath]);
      const written = await Bun.file(outPath).text();
      expect(written).toBe("file content");
      expect(out.stdout).toContain("HTTP 200");
    });

    test("includes HTTP status in log on error response without --fail", async () => {
      fetchSpy.mockImplementation(async () => new Response("not found", { status: 404, statusText: "Not Found" }));
      const outPath = join(tmpDir, "err.txt");

      await cli.parseAsync(["test", "use-agently", "web", "get", "http://example.com/404", "--output-file", outPath]);

      expect(out.stdout).toContain("HTTP 404");
    });

    test("exits 1 on error response with --fail", async () => {
      fetchSpy.mockImplementation(async () => new Response("not found", { status: 404, statusText: "Not Found" }));
      const outPath = join(tmpDir, "err-fail.txt");

      let exitCode: number | undefined;
      const origExit = process.exit.bind(process);
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error(`process.exit(${code})`);
      }) as typeof process.exit;

      try {
        await cli.parseAsync([
          "test",
          "use-agently",
          "web",
          "get",
          "http://example.com/404",
          "--output-file",
          outPath,
          "--fail",
        ]);
      } catch {
        // expected
      } finally {
        process.exit = origExit;
      }

      expect(exitCode).toBe(1);
    });
  });

  describe("PUT, PATCH, DELETE via CLI", () => {
    const out = captureOutput();

    test("PUT sends body", async () => {
      let capturedMethod: string | undefined;
      let capturedBody: string | undefined;
      fetchSpy.mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        capturedMethod = init?.method;
        capturedBody = init?.body as string;
        return new Response(`put: ${capturedBody}`, { status: 200, statusText: "OK" });
      });

      await cli.parseAsync([
        "test",
        "use-agently",
        "-o",
        "tui",
        "web",
        "put",
        "http://example.com/r",
        "-d",
        '{"up":1}',
      ]);
      expect(capturedMethod).toBe("PUT");
      expect(out.stdout).toContain('put: {"up":1}');
    });

    test("PATCH sends body", async () => {
      let capturedMethod: string | undefined;
      fetchSpy.mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        capturedMethod = init?.method;
        return new Response("patched", { status: 200, statusText: "OK" });
      });

      await cli.parseAsync(["test", "use-agently", "web", "patch", "http://example.com/r", "-d", '{"p":1}']);
      expect(capturedMethod).toBe("PATCH");
      expect(out.stdout).toContain("patched");
    });

    test("DELETE request", async () => {
      let capturedMethod: string | undefined;
      fetchSpy.mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        capturedMethod = init?.method;
        return new Response("deleted", { status: 200, statusText: "OK" });
      });

      await cli.parseAsync(["test", "use-agently", "web", "delete", "http://example.com/r"]);
      expect(capturedMethod).toBe("DELETE");
      expect(out.stdout).toContain("deleted");
    });
  });

  describe("URL validation", () => {
    const out = captureOutput();

    test("rejects invalid URL with actionable error", async () => {
      await expect(cli.parseAsync(["test", "use-agently", "web", "get", "not-a-url"])).rejects.toThrow("Invalid URL");
    });

    test("rejects file:// scheme", async () => {
      await expect(cli.parseAsync(["test", "use-agently", "web", "get", "file:///etc/passwd"])).rejects.toThrow(
        'Unsupported URL scheme "file:"',
      );
    });

    test("rejects ftp:// scheme", async () => {
      await expect(cli.parseAsync(["test", "use-agently", "web", "get", "ftp://example.com/file"])).rejects.toThrow(
        'Unsupported URL scheme "ftp:"',
      );
    });

    test("rejects data: scheme", async () => {
      await expect(cli.parseAsync(["test", "use-agently", "web", "get", "data:text/plain,hello"])).rejects.toThrow(
        'Unsupported URL scheme "data:"',
      );
    });
  });

  describe("--max-filesize", () => {
    const out = captureOutput();

    test("rejects response exceeding default max size via content-length", async () => {
      fetchSpy.mockImplementation(
        async () =>
          new Response("big", {
            status: 200,
            statusText: "OK",
            headers: { "Content-Length": String(200 * 1024 * 1024) },
          }),
      );

      await expect(cli.parseAsync(["test", "use-agently", "web", "get", "http://example.com/big"])).rejects.toThrow(
        "Response too large",
      );
    });

    test("rejects response exceeding custom --max-filesize", async () => {
      fetchSpy.mockImplementation(
        async () =>
          new Response("medium", {
            status: 200,
            statusText: "OK",
            headers: { "Content-Length": "2000" },
          }),
      );

      await expect(
        cli.parseAsync(["test", "use-agently", "web", "get", "http://example.com/med", "--max-filesize", "1000"]),
      ).rejects.toThrow("Response too large");
    });

    test("allows response within custom --max-filesize", async () => {
      fetchSpy.mockImplementation(
        async () =>
          new Response("small", {
            status: 200,
            statusText: "OK",
            headers: { "Content-Length": "500" },
          }),
      );

      await cli.parseAsync(["test", "use-agently", "web", "get", "http://example.com/sm", "--max-filesize", "1000"]);
      expect(out.stdout).toContain("small");
    });

    test("rejects invalid --max-filesize value", async () => {
      await expect(
        cli.parseAsync(["test", "use-agently", "web", "get", "http://example.com/x", "--max-filesize", "abc"]),
      ).rejects.toThrow("Invalid --max-filesize");
    });
  });

  describe("-L / --location (redirect following)", () => {
    const out = captureOutput();

    test("without -L uses manual redirect mode", async () => {
      let capturedRedirect: RequestRedirect | undefined;
      fetchSpy.mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        capturedRedirect = init?.redirect;
        return new Response("ok", { status: 200, statusText: "OK" });
      });

      await cli.parseAsync(["test", "use-agently", "web", "get", "http://example.com/redir"]);
      expect(capturedRedirect).toBe("manual");
    });

    test("with -L uses follow redirect mode", async () => {
      let capturedRedirect: RequestRedirect | undefined;
      fetchSpy.mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
        capturedRedirect = init?.redirect;
        return new Response("ok", { status: 200, statusText: "OK" });
      });

      await cli.parseAsync(["test", "use-agently", "web", "get", "http://example.com/redir", "-L"]);
      expect(capturedRedirect).toBe("follow");
    });
  });

  describe("non-2xx exit codes", () => {
    const out = captureOutput();

    test("does not exit 1 on 500 response without --fail", async () => {
      fetchSpy.mockImplementation(
        async () => new Response("server error", { status: 500, statusText: "Internal Server Error" }),
      );

      await cli.parseAsync(["test", "use-agently", "web", "get", "http://example.com/500"]);

      expect(out.stdout).toContain("server error");
    });

    test("exits 1 on 500 response with --fail", async () => {
      fetchSpy.mockImplementation(
        async () => new Response("server error", { status: 500, statusText: "Internal Server Error" }),
      );

      let exitCode: number | undefined;
      const origExit = process.exit.bind(process);
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error(`process.exit(${code})`);
      }) as typeof process.exit;

      try {
        await cli.parseAsync(["test", "use-agently", "web", "get", "http://example.com/500", "--fail"]);
      } catch {
        // expected
      } finally {
        process.exit = origExit;
      }

      expect(exitCode).toBe(1);
      expect(out.stdout).toContain("server error");
    });
  });
});

describe("web x402 payment", () => {
  let fixture: X402FacilitatorLocal;

  beforeAll(async () => {
    fixture = await startX402FacilitatorLocal();
  }, 120_000);

  afterAll(async () => {
    if (fixture) await stopX402FacilitatorLocal(fixture);
  }, 30_000);

  function httpUrl(path: string): string {
    return fixture.agent.getAgentHost() + path;
  }

  describe("free HTTP endpoints", () => {
    test("GET /http/free returns 200", async () => {
      const res = await fetch(httpUrl("/http/free"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("free GET response");
    });

    test("POST /http/free echoes body", async () => {
      const res = await fetch(httpUrl("/http/free"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hello: "world" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("free POST response");
      expect(body.body).toStrictEqual({ hello: "world" });
    });

    test("PUT /http/free echoes body", async () => {
      const res = await fetch(httpUrl("/http/free"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ update: true }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("free PUT response");
      expect(body.body).toStrictEqual({ update: true });
    });

    test("DELETE /http/free returns 200", async () => {
      const res = await fetch(httpUrl("/http/free"), { method: "DELETE" });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("free DELETE response");
    });
  });

  describe("paid HTTP endpoints", () => {
    test("dry-run GET on /http/paid throws DryRunPaymentRequired", async () => {
      const dryRunFetch = createDryRunFetch();
      try {
        await dryRunFetch(httpUrl("/http/paid"));
        throw new Error("Expected DryRunPaymentRequired to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(DryRunPaymentRequired);
        const err = e as DryRunPaymentRequired;
        expect(err.requirements.length).toBeGreaterThan(0);
        expect(err.message).toContain("--pay");
      }
    });

    test("dry-run POST on /http/paid throws DryRunPaymentRequired", async () => {
      const dryRunFetch = createDryRunFetch();
      try {
        await dryRunFetch(httpUrl("/http/paid"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ test: true }),
        });
        throw new Error("Expected DryRunPaymentRequired to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(DryRunPaymentRequired);
      }
    });

    test("paid GET succeeds with funded wallet and debits sender $0.003", async () => {
      const wallet = new EvmPrivateKeyWallet(TEST_PRIVATE_KEY, fixture.container.getRpcUrl());
      const paymentFetch = createPaymentFetch(wallet);

      const senderBefore = await fixture.container.balance(TEST_ADDRESS);

      const response = await (paymentFetch as typeof fetch)(httpUrl("/http/paid"));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.message).toBe("paid GET response");

      const senderAfter = await fixture.container.balance(TEST_ADDRESS);
      expect(senderBefore.value - senderAfter.value).toStrictEqual(3000n);
    }, 30_000);

    test("paid POST succeeds with funded wallet and debits sender $0.003", async () => {
      const wallet = new EvmPrivateKeyWallet(TEST_PRIVATE_KEY, fixture.container.getRpcUrl());
      const paymentFetch = createPaymentFetch(wallet);

      const senderBefore = await fixture.container.balance(TEST_ADDRESS);

      const response = await (paymentFetch as typeof fetch)(httpUrl("/http/paid"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: true }),
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.message).toBe("paid POST response");
      expect(body.body).toStrictEqual({ paid: true });

      const senderAfter = await fixture.container.balance(TEST_ADDRESS);
      expect(senderBefore.value - senderAfter.value).toStrictEqual(3000n);
    }, 30_000);
  });

  describe("cli", () => {
    const out = captureOutput();

    test("web get without --pay on /http/paid shows dry-run cost and exits 1", async () => {
      let exitCode: number | undefined;
      const origExit = process.exit.bind(process);
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error(`process.exit(${code})`);
      }) as typeof process.exit;

      try {
        await cli.parseAsync(["test", "use-agently", "web", "get", httpUrl("/http/paid")]);
      } catch {
        // expected: process.exit throws
      } finally {
        process.exit = origExit;
      }

      expect(exitCode).toBe(1);
      expect(out.stderr).toContain("--pay");
    });

    test("web get with --pay on /http/paid succeeds and debits sender", async () => {
      mockConfigModule(() => ({ wallet: testWalletConfig(fixture.container.getRpcUrl()) }));

      const senderBefore = await fixture.container.balance(TEST_ADDRESS);

      await cli.parseAsync(["test", "use-agently", "web", "get", httpUrl("/http/paid"), "--pay"]);
      expect(out.stdout).toContain("paid GET response");

      const senderAfter = await fixture.container.balance(TEST_ADDRESS);
      expect(senderBefore.value - senderAfter.value).toStrictEqual(3000n);

      // Restore default mock
      mockConfigModule();
    }, 30_000);

    test("web post with --pay on /http/paid succeeds and debits sender", async () => {
      mockConfigModule(() => ({ wallet: testWalletConfig(fixture.container.getRpcUrl()) }));

      const senderBefore = await fixture.container.balance(TEST_ADDRESS);

      await cli.parseAsync([
        "test",
        "use-agently",
        "web",
        "post",
        httpUrl("/http/paid"),
        "-d",
        '{"cli":"paid"}',
        "-H",
        "Content-Type: application/json",
        "--pay",
      ]);
      expect(out.stdout).toContain("paid POST response");

      const senderAfter = await fixture.container.balance(TEST_ADDRESS);
      expect(senderBefore.value - senderAfter.value).toStrictEqual(3000n);

      // Restore default mock
      mockConfigModule();
    }, 30_000);
  });
});
