import { customActionProvider, EvmWalletProvider } from "@coinbase/agentkit";
import { wrapFetchWithPayment } from "@libertai/x402";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";

const DEFAULT_ALEPH_API_URLS = [
  "https://api2.aleph.im",
  "https://api3.aleph.im",
];

const LIBERTAI_API_BASE = "https://api.libertai.io";
const CREDITS_DECIMALS = 6;

interface AlephOptions {
  alephApiUrls?: string[];
}

export function createAlephActionProvider(
  privateKey: Hex,
  options?: AlephOptions,
) {
  const alephApiUrls = options?.alephApiUrls ?? DEFAULT_ALEPH_API_URLS;
  const account = privateKeyToAccount(privateKey);
  const fetchWithPayment = wrapFetchWithPayment(privateKey);

  return customActionProvider<EvmWalletProvider>([
    {
      name: "get_credits_info",
      description:
        "Get your current Aleph credit balance (in USD), cost per day (in USD), and estimated runway in days. Use this to decide whether you need to buy more credits.",
      schema: z.object({}),
      invoke: async (_walletProvider: EvmWalletProvider, _args: unknown) => {
        const address = account.address;

        for (const baseUrl of alephApiUrls) {
          try {
            const [balanceRes, costsRes] = await Promise.all([
              fetch(`${baseUrl}/api/v0/addresses/${address}/balance`),
              fetch(
                `${baseUrl}/api/v0/costs?include_details=0&include_size=true&address=${address}`,
              ),
            ]);

            if (!balanceRes.ok || !costsRes.ok) {
              continue;
            }

            const balanceData = (await balanceRes.json()) as {
              credit_balance: number;
            };
            const costsData = (await costsRes.json()) as {
              summary: { total_cost_credit: number };
            };

            const toUsd = (credits: number) => credits / 10 ** CREDITS_DECIMALS;

            const balanceUsd = toUsd(balanceData.credit_balance);
            const costPerSecondUsd = toUsd(costsData.summary.total_cost_credit);
            const costPerDayUsd = costPerSecondUsd * 86400;
            const runwayDays =
              costPerDayUsd > 0 ? balanceUsd / costPerDayUsd : null;

            return JSON.stringify({
              balance_usd: balanceUsd,
              cost_per_day_usd: costPerDayUsd,
              runway_days: runwayDays,
            });
          } catch {
            continue;
          }
        }

        return "Error: failed to fetch credits info from all Aleph API endpoints";
      },
    },
    {
      name: "buy_credits",
      description:
        "Buy Aleph credits using x402 payment. Specify the amount in USD to spend on credits.",
      schema: z.object({
        amount: z.number().positive().describe("Amount in USD to spend"),
      }),
      invoke: async (
        _walletProvider: EvmWalletProvider,
        args: { amount: number },
      ) => {
        try {
          const address = account.address;

          const response = await fetchWithPayment(
            `${LIBERTAI_API_BASE}/libertai/aleph-credits`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ address, amount: args.amount }),
            },
          );

          if (!response.ok) {
            const text = await response.text();
            return `Error buying credits: ${response.status} ${text}`;
          }

          const result = (await response.json()) as {
            status: string;
            credits_purchased: number;
            recipient: string;
          };
          return JSON.stringify(result);
        } catch (err) {
          return `Error buying credits: ${err instanceof Error ? err.message : String(err)}`;
        }
      },
    },
  ]);
}
