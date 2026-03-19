import { afterEach, beforeEach, mock, spyOn } from "bun:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  X402FacilitatorLocalContainer,
  type StartedX402FacilitatorLocalContainer,
  accounts,
} from "x402-fl/testcontainers";
import { AixyzTesting } from "localhost-aixyz/test";

// --- Test wallet ---

export const TEST_PRIVATE_KEY = generatePrivateKey();
export const TEST_ADDRESS = privateKeyToAccount(TEST_PRIVATE_KEY).address;

export function testWalletConfig(rpcUrl?: string) {
  return {
    type: "evm-private-key" as const,
    privateKey: TEST_PRIVATE_KEY,
    address: TEST_ADDRESS,
    ...(rpcUrl ? { rpcUrl } : {}),
  };
}

export function testConfig() {
  return { wallet: testWalletConfig() };
}

// --- x402 facilitator local ---

export interface X402FacilitatorLocal {
  container: StartedX402FacilitatorLocalContainer;
  agent: AixyzTesting;
}

export interface X402FacilitatorLocalOptions {
  fundAmount?: string;
  fundAddress?: `0x${string}`;
  network?: string;
  payTo?: string;
}

export async function startX402FacilitatorLocal(options?: X402FacilitatorLocalOptions): Promise<X402FacilitatorLocal> {
  const container = await new X402FacilitatorLocalContainer().start();
  await container.fund((options?.fundAddress ?? TEST_ADDRESS) as `0x${string}`, options?.fundAmount ?? "100");
  const agent = new AixyzTesting();
  await agent.start({
    env: {
      X402_FACILITATOR_URL: container.getFacilitatorUrl(),
      X402_PAY_TO: options?.payTo ?? accounts.facilitator.address,
      X402_NETWORK: options?.network ?? "eip155:8453",
    },
  });
  return { container, agent };
}

export async function stopX402FacilitatorLocal(fixture: X402FacilitatorLocal): Promise<void> {
  try {
    await fixture.agent.stop();
  } catch (e) {
    console.error("Error stopping agent server:", e);
  }
  try {
    await fixture.container.stop();
  } catch (e) {
    console.error("Error stopping facilitator container:", e);
  }
}

// --- Test output capture ---

/**
 * Capture console.log and console.error output during tests.
 * Call inside a `describe` block. Spies are set up in beforeEach and restored in afterEach.
 */
export function captureOutput() {
  let logSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;
  let writeSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    logSpy = spyOn(console, "log").mockImplementation(() => {});
    errorSpy = spyOn(console, "error").mockImplementation(() => {});
    writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    writeSpy.mockRestore();
  });

  return {
    /**
     * All text written to process.stdout.write (streamed output), concatenated.
     * Falls back to the first console.log call for non-streaming output.
     */
    get stdout(): string {
      const written = (writeSpy.mock.calls as [string | Uint8Array][])
        .map(([chunk]) => (typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk)))
        .join("");
      if (written) return written.replace(/\n+$/, "");
      return logSpy.mock.calls[0]?.[0] as string;
    },
    /** Raw stderr string from the first console.error call */
    get stderr(): string {
      return errorSpy.mock.calls[0]?.[0] as string;
    },
    /** Parse stdout as JSON (first console.log call) */
    get json(): unknown {
      return JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    },
    /** Parse all console.log calls as NDJSON lines */
    get jsonLines(): unknown[] {
      return logSpy.mock.calls.map((call: unknown[]) => JSON.parse(call[0] as string));
    },
    get logSpy() {
      return logSpy;
    },
    get errorSpy() {
      return errorSpy;
    },
  };
}

// --- Config mock ---

/**
 * Mock the config functions exported from `./config.js` with a static wallet config.
 * Accepts an optional getter so tests can swap the config dynamically.
 */
export function mockConfigModule(getConfig?: () => unknown) {
  const resolve = getConfig ?? (() => testConfig());
  mock.module("./config.js", () => ({
    getConfigOrThrow: async () => {
      const cfg = resolve();
      if (!cfg || !(cfg as any).wallet) throw new Error("No wallet configured. Initialize a wallet first.");
      return cfg;
    },
    loadConfig: async () => resolve(),
    saveConfig: async () => {},
    backupConfig: async () => "",
  }));
}
