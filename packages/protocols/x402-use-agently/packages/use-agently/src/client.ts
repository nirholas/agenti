import boxen from "boxen";
import { formatUnits } from "viem";
import {
  DryRunPaymentRequired as SdkDryRunPaymentRequired,
  createDryRunFetch as sdkCreateDryRunFetch,
  createPaymentFetch as sdkCreatePaymentFetch,
  getChainConfigByNetwork,
  type PaymentRequirementsInfo,
  loadWallet,
} from "@use-agently/sdk";
import { getConfigOrThrow } from "./config";
import pkg from "../package.json" with { type: "json" };
import { createClient } from "@use-agently/sdk/client";

const CLI_USER_AGENT = `use-agently:${pkg.version} (use-agently.com)`;

export const defaultClient = createClient({ userAgent: CLI_USER_AGENT });

/** CLI-specific fetch client with CLI user-agent. */
export const clientFetch: typeof fetch = defaultClient.fetch;

/** CLI-specific DryRunPaymentRequired with --pay hint in the message. */
export class DryRunPaymentRequired extends SdkDryRunPaymentRequired {
  constructor(requirements: PaymentRequirementsInfo[]) {
    super(requirements);
    const req = requirements[0];
    const amount = req ? formatUsdcAmount(req) : null;
    this.message = amount
      ? `This request requires payment of ${amount}.\nRun the same command with --pay to authorize the transaction and proceed.`
      : `This request requires payment, but the amount could not be determined.\nInspect the endpoint manually before running with --pay.`;
  }
}

/** CLI wrapper around SDK's createDryRunFetch that throws CLI-specific DryRunPaymentRequired. */
export function createDryRunFetch(): typeof fetch {
  const sdkFetch = sdkCreateDryRunFetch(clientFetch);
  // @ts-expect-error — Bun's typeof fetch includes preconnect namespace (oven-sh/bun#23741)
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      return await sdkFetch(input, init);
    } catch (err) {
      if (err instanceof SdkDryRunPaymentRequired) {
        throw new DryRunPaymentRequired(err.requirements);
      }
      throw err;
    }
  };
}

export function createPaymentFetch(wallet: ReturnType<typeof loadWallet>) {
  return sdkCreatePaymentFetch(wallet, clientFetch);
}

/** Resolve the fetch implementation based on the --pay flag. */
export async function resolveFetch(pay?: boolean): Promise<typeof fetch> {
  if (pay) {
    const config = await getConfigOrThrow();
    const wallet = loadWallet(config.wallet);
    return sdkCreatePaymentFetch(wallet, clientFetch) as typeof fetch;
  }
  return createDryRunFetch();
}

function formatUsdcAmount(req: PaymentRequirementsInfo): string {
  try {
    const { usdcDecimals } = getChainConfigByNetwork(req.network);
    const raw = formatUnits(BigInt(req.amount), usdcDecimals);
    const formatted = raw.includes(".") ? raw.replace(/\.?0+$/, "") : raw;
    const network = req.network ? ` on ${req.network}` : "";
    return `$${formatted} USDC${network}`;
  } catch {
    return `${req.amount} (raw units)`;
  }
}

/** Display a DryRunPaymentRequired error and exit. Uses boxen when stderr is a TTY, plain text otherwise. */
export function handleDryRunError(err: SdkDryRunPaymentRequired): never {
  const cliErr = err instanceof DryRunPaymentRequired ? err : new DryRunPaymentRequired(err.requirements);
  if (process.stderr.isTTY) {
    console.error(
      boxen(cliErr.message, {
        title: "Payment Required",
        titleAlignment: "center",
        borderColor: "yellow",
        padding: 1,
      }),
    );
  } else {
    console.error(`Payment Required: ${cliErr.message}`);
  }
  process.exit(1);
}
