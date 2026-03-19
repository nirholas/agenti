/**
 * x402 Yield Tools
 * @description Yield/APY tools and Sperax USDs deep integration tools
 * @author nirholas
 * @license Apache-2.0
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { LegacyConfig, FullConfig } from "./shared.js"
import { getClient } from "./shared.js"

export function registerYieldTools(server: McpServer, config: LegacyConfig, fullConfig: FullConfig): void {

  // Tool 7: Get yield info (USDs specific)
  server.tool(
    "x402_yield",
    "Get yield information for your USDs holdings. USDs automatically earns ~5% APY.",
    {},
    async () => {
      try {
        const client = getClient()
        const yieldInfo = await client.getYield()

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              balance: yieldInfo.balance,
              pendingYield: yieldInfo.pending,
              apy: yieldInfo.apy,
              totalEarned: yieldInfo.totalEarned,
              lastUpdate: yieldInfo.lastUpdate,
              projectedMonthly: yieldInfo.projectedMonthly,
              note: "USDs automatically rebases - your balance grows without claiming!",
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // Tool 11: Get current APY
  server.tool(
    "x402_apy",
    "Get the current APY (Annual Percentage Yield) for USDs stablecoin.",
    {},
    async () => {
      try {
        const client = getClient()
        const apy = await client.getCurrentAPY()

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              token: "USDs",
              apy: `${(apy * 100).toFixed(2)}%`,
              apyDecimal: apy,
              source: "Sperax Protocol",
              note: "USDs earns yield automatically via rebasing. No staking required.",
              comparison: {
                savingsAccount: "~0.5%",
                usdc: "0%",
                usds: `${(apy * 100).toFixed(2)}%`,
              },
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // Tool 12: Estimate yield over time
  server.tool(
    "x402_yield_estimate",
    "Estimate how much yield you would earn over a period of time.",
    {
      amount: z.string().describe("Amount of USDs to calculate yield for"),
      days: z.number().default(30).describe("Number of days to estimate"),
    },
    async (params: { amount: string; days: number }) => {
      try {
        const client = getClient()
        const apy = await client.getCurrentAPY()

        const principal = parseFloat(params.amount)
        const dailyRate = apy / 365
        const yieldEarned = principal * dailyRate * params.days
        const finalBalance = principal + yieldEarned

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              principal: `${principal.toFixed(2)} USDs`,
              period: `${params.days} days`,
              currentAPY: `${(apy * 100).toFixed(2)}%`,
              estimatedYield: `${yieldEarned.toFixed(4)} USDs`,
              finalBalance: `${finalBalance.toFixed(4)} USDs`,
              projections: {
                "7 days": `+${(principal * dailyRate * 7).toFixed(4)} USDs`,
                "30 days": `+${(principal * dailyRate * 30).toFixed(4)} USDs`,
                "90 days": `+${(principal * dailyRate * 90).toFixed(4)} USDs`,
                "365 days": `+${(principal * apy).toFixed(4)} USDs`,
              },
              note: "Actual yield may vary based on protocol performance.",
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // Sperax USDs Deep Integration - Yield Tools
  // "AI agents don't just GET paid - they EARN while they wait"
  // ============================================================================

  // Tool 30: usds_yield_balance - Get USDs balance with yield info
  server.tool(
    "usds_yield_balance",
    "Get your USDs balance with detailed yield information. USDs automatically earns ~5% APY - " +
    "making it the superior payment token for AI agents.",
    {
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
        .describe("Address to check (defaults to configured wallet)"),
    },
    async ({ address }) => {
      try {
        const client = getClient()
        const targetAddress = address || await client.getAddress()

        if (!targetAddress) {
          throw new Error("No address specified and wallet not configured")
        }

        // Import YieldingWallet
        const { YieldingWallet } = await import("../sdk/wallet/yielding-wallet.js")
        const wallet = new YieldingWallet(
          client.getPublicClient(),
          client.getWalletClient(),
          config.chain as any
        )

        const balances = await wallet.getBalances()
        const projection = await wallet.projectYield()

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              address: targetAddress,
              balance: {
                usds: balances.usds.formattedBalance,
                isRebasing: balances.usds.isRebasing,
                pendingYield: balances.usds.pendingYield,
              },
              yield: {
                currentAPY: `${projection.apy}%`,
                dailyYield: `$${(parseFloat(projection.monthlyPassiveIncome) / 30).toFixed(4)}`,
                monthlyYield: `$${projection.monthlyPassiveIncome}`,
                annualYield: `$${projection.annualPassiveIncome}`,
              },
              comparison: {
                usds: `${projection.apy}% APY (auto-yield)`,
                usdc: "0% APY (no yield)",
                savingsAccount: "~0.5% APY",
                message: "USDs earns 10x more than a savings account!",
              },
              gasReserve: {
                eth: balances.gasReserve.formattedBalance,
                sufficient: balances.gasReserve.sufficient,
              },
              marketing: {
                tagline: "AI agents don't just GET paid - they EARN while they wait",
                benefit: "Every payment grows. Every balance compounds.",
              },
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
              note: "USDs yield tracking requires Arbitrum. Set X402_CHAIN=arbitrum",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // Tool 31: usds_yield_history - Get yield history
  server.tool(
    "usds_yield_history",
    "Get your USDs yield history showing how much you've earned passively over time.",
    {
      days: z.number().default(30).describe("Number of days to show history for"),
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional()
        .describe("Address to check (defaults to configured wallet)"),
    },
    async ({ days, address }) => {
      try {
        const client = getClient()
        const targetAddress = address || await client.getAddress()

        if (!targetAddress) {
          throw new Error("No address specified and wallet not configured")
        }

        const { YieldingWallet } = await import("../sdk/wallet/yielding-wallet.js")
        const wallet = new YieldingWallet(
          client.getPublicClient(),
          client.getWalletClient(),
          config.chain as any
        )

        const history = await wallet.getYieldHistory(days)

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              address: targetAddress,
              period: history.period,
              summary: {
                totalYield: `$${history.totalYield}`,
                averageDailyYield: `$${history.averageDailyYield}`,
                effectiveAPY: `${history.effectiveAPY}%`,
              },
              balances: {
                starting: `$${history.startingBalance}`,
                ending: `$${history.endingBalance}`,
                growth: `$${(parseFloat(history.endingBalance) - parseFloat(history.startingBalance)).toFixed(2)}`,
              },
              insight: `Your USDs earned $${history.totalYield} passively over ${days} days!`,
              projection: `At this rate, you'll earn ~$${(parseFloat(history.totalYield) * (365 / days)).toFixed(2)} per year`,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // Tool 32: yield_projection - Project future yield earnings
  server.tool(
    "yield_projection",
    "Project your future USDs yield earnings. See how your balance will grow over time with compound interest.",
    {
      amount: z.string().optional().describe("Custom amount to project (defaults to current balance)"),
      targetBalance: z.number().optional().describe("Target balance to reach - shows time needed"),
    },
    async ({ amount, targetBalance }) => {
      try {
        const client = getClient()

        const { YieldingWallet } = await import("../sdk/wallet/yielding-wallet.js")
        const wallet = new YieldingWallet(
          client.getPublicClient(),
          client.getWalletClient(),
          config.chain as any
        )

        const projection = await wallet.projectYield(amount)

        let targetInfo = null
        if (targetBalance) {
          targetInfo = await wallet.calculateYieldToTarget(targetBalance)
        }

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              currentBalance: `$${projection.currentBalance}`,
              apy: `${projection.apy}%`,
              passiveIncome: {
                monthly: `$${projection.monthlyPassiveIncome}`,
                annual: `$${projection.annualPassiveIncome}`,
              },
              projections: projection.projections.map(p => ({
                period: p.period,
                balance: `$${p.projectedBalance}`,
                yield: `$${p.compoundedYield}`,
              })),
              timeToDouble: projection.timeToDouble ? {
                days: projection.timeToDouble.days,
                months: projection.timeToDouble.months,
                years: projection.timeToDouble.years,
              } : "N/A (insufficient balance)",
              targetAnalysis: targetInfo ? {
                target: `$${targetInfo.targetBalance}`,
                yieldNeeded: `$${targetInfo.yieldNeeded}`,
                estimatedTime: targetInfo.estimatedTime,
                depositToReachIn1Year: `$${targetInfo.additionalDepositNeeded}`,
              } : null,
              insight: `With $${projection.currentBalance} in USDs, you'll earn $${projection.annualPassiveIncome}/year doing nothing!`,
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // Tool 33: yield_report - Monthly yield earnings report
  server.tool(
    "yield_report",
    "Generate a detailed monthly yield report showing daily earnings, totals, and projections.",
    {
      month: z.number().min(1).max(12).describe("Month (1-12)"),
      year: z.number().default(new Date().getFullYear()).describe("Year (defaults to current year)"),
    },
    async ({ month, year }) => {
      try {
        const client = getClient()

        const { YieldingWallet } = await import("../sdk/wallet/yielding-wallet.js")
        const wallet = new YieldingWallet(
          client.getPublicClient(),
          client.getWalletClient(),
          config.chain as any
        )

        const report = await wallet.generateMonthlyReport(month, year)

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              report: {
                period: `${report.month} ${report.year}`,
                totalYieldEarned: `$${report.totalYieldEarned}`,
                averageAPY: `${report.averageAPY}%`,
              },
              balances: {
                starting: `$${report.startingBalance}`,
                ending: `$${report.endingBalance}`,
                netGrowth: `$${report.netGrowth}`,
              },
              deposits: `$${report.totalDeposits}`,
              withdrawals: `$${report.totalWithdrawals}`,
              projectedAnnualYield: `$${report.projectedAnnualYield}`,
              dailyBreakdown: report.entries.slice(0, 7).map(e => ({
                date: e.date,
                yield: `$${e.yieldEarned}`,
                balance: `$${e.endingBalance}`,
              })),
              summary: `You earned $${report.totalYieldEarned} in ${report.month} ${report.year} just by holding USDs!`,
              tip: "Convert more of your payments to USDs to maximize yield earnings.",
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // Tool 34: auto_compound - Configure auto-compound settings
  server.tool(
    "auto_compound",
    "Configure auto-compound settings for USDs yield. When enabled, yield is automatically reinvested.",
    {
      enabled: z.boolean().describe("Enable or disable auto-compound"),
      autoConvertToUSDs: z.boolean().default(true).describe("Auto-convert all received payments to USDs"),
      minConversionAmount: z.string().default("1.00").describe("Minimum amount to trigger conversion"),
    },
    async ({ enabled, autoConvertToUSDs, minConversionAmount }) => {
      try {
        const client = getClient()

        const { YieldingWallet } = await import("../sdk/wallet/yielding-wallet.js")
        const wallet = new YieldingWallet(
          client.getPublicClient(),
          client.getWalletClient(),
          config.chain as any,
          {
            autoCompound: enabled,
            autoConvertToUSDs,
            minConversionAmount,
            minGasReserve: "0.01",
            gasReserveToken: "ETH",
            enableYieldNotifications: true,
            yieldNotificationThreshold: "1.00",
          }
        )

        const currentConfig = wallet.getConfig()
        const projection = await wallet.projectYield()

        // Calculate compound vs simple yield difference
        const balance = parseFloat(projection.currentBalance)
        const apy = parseFloat(projection.apy) / 100
        const simpleYield = balance * apy
        const compoundYield = balance * (Math.pow(1 + apy/365, 365) - 1)
        const compoundAdvantage = compoundYield - simpleYield

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              settings: {
                autoCompound: currentConfig.autoCompound,
                autoConvertToUSDs: currentConfig.autoConvertToUSDs,
                minConversionAmount: currentConfig.minConversionAmount,
              },
              benefit: {
                withoutCompound: `$${simpleYield.toFixed(2)}/year (simple interest)`,
                withCompound: `$${compoundYield.toFixed(2)}/year (compound interest)`,
                extraEarnings: `$${compoundAdvantage.toFixed(2)}/year extra from compounding!`,
              },
              explanation: enabled
                ? "Auto-compound enabled! Your yield will automatically compound, earning yield on yield."
                : "Auto-compound disabled. Consider enabling to maximize earnings.",
              marketing: {
                tagline: "Every payment grows. Every balance compounds.",
                tip: "Auto-compound + auto-convert = maximum passive income",
              },
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // Tool 35: usds_convert_recommendation - Should I convert to USDs?
  server.tool(
    "usds_convert_recommendation",
    "Get a recommendation on whether to convert a token to USDs for yield. " +
    "Calculates opportunity cost of NOT holding USDs.",
    {
      token: z.enum(["USDC", "USDT", "DAI"]).describe("Token you're considering converting"),
      amount: z.string().describe("Amount you're considering converting"),
      holdingPeriod: z.number().default(365).describe("How long you plan to hold (days)"),
    },
    async ({ token, amount, holdingPeriod }) => {
      try {
        const client = getClient()

        const { YieldingWallet } = await import("../sdk/wallet/yielding-wallet.js")
        const wallet = new YieldingWallet(
          client.getPublicClient(),
          client.getWalletClient(),
          config.chain as any
        )

        const recommendation = await wallet.shouldConvert(token as any, amount)
        const apy = await client.getCurrentAPY()

        // Calculate opportunity cost
        const amountNum = parseFloat(amount)
        const dailyRate = apy / 365
        const yieldIfConverted = amountNum * dailyRate * holdingPeriod
        const compoundedBalance = amountNum * Math.pow(1 + dailyRate, holdingPeriod)
        const compoundedYield = compoundedBalance - amountNum

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              recommendation: recommendation.recommended ? "CONVERT TO USDs" : "ALREADY OPTIMAL",
              reason: recommendation.reason,
              analysis: {
                currentToken: token,
                currentYield: "0% APY",
                usdsYield: `${(apy * 100).toFixed(2)}% APY`,
              },
              opportunityCost: {
                holdingPeriod: `${holdingPeriod} days`,
                yieldMissed: `$${yieldIfConverted.toFixed(2)} (simple)`,
                compoundYieldMissed: `$${compoundedYield.toFixed(2)} (compound)`,
              },
              projection: {
                keepAs: `$${amount} ${token} → $${amount} ${token} (no growth)`,
                convertToUSDs: `$${amount} USDs → $${compoundedBalance.toFixed(2)} USDs`,
                difference: `+$${compoundedYield.toFixed(2)} by converting!`,
              },
              verdict: yieldIfConverted > 1
                ? `You're missing out on $${yieldIfConverted.toFixed(2)} in yield! Convert now.`
                : `Small amount - conversion optional, but USDs is always better.`,
              action: recommendation.recommended
                ? "Use x402_send or DEX to swap to USDs on Arbitrum"
                : "You're already earning yield!",
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // Tool 36: usds_why_usds - Marketing/educational tool
  server.tool(
    "usds_why_usds",
    "Learn why USDs is the superior payment token for AI agents. Educational tool about Sperax USDs benefits.",
    {},
    async () => {
      try {
        const client = getClient()
        const apy = await client.getCurrentAPY()

        // Example calculations
        const exampleBalance = 1000
        const dailyYield = exampleBalance * (apy / 365)
        const monthlyYield = dailyYield * 30
        const annualYield = exampleBalance * apy

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              title: "🏆 Why USDs is the Superior AI Payment Token",
              taglines: [
                "AI agents don't just GET paid - they EARN while they wait",
                "Every payment grows. Every balance compounds.",
                "Your money works as hard as you do.",
              ],
              whatIsUSDs: {
                name: "Sperax USD (USDs)",
                type: "Auto-yield stablecoin",
                network: "Arbitrum",
                mechanism: "Automatic rebasing - balance grows without staking or claiming",
              },
              currentAPY: `${(apy * 100).toFixed(2)}%`,
              comparison: {
                usds: {
                  apy: `${(apy * 100).toFixed(2)}%`,
                  staking: "Not required",
                  claiming: "Automatic (rebasing)",
                  verdict: "✅ Best for AI agents",
                },
                usdc: {
                  apy: "0%",
                  staking: "N/A",
                  claiming: "N/A",
                  verdict: "❌ Dead money",
                },
                savingsAccount: {
                  apy: "~0.5%",
                  staking: "N/A",
                  claiming: "Manual",
                  verdict: "❌ 10x less than USDs",
                },
              },
              exampleEarnings: {
                balance: `$${exampleBalance}`,
                daily: `+$${dailyYield.toFixed(4)}`,
                monthly: `+$${monthlyYield.toFixed(2)}`,
                annual: `+$${annualYield.toFixed(2)}`,
              },
              aiAgentBenefits: [
                "Passive income while waiting for requests",
                "Payment revenue automatically grows",
                "No manual yield farming required",
                "Compound interest accelerates growth",
                "Stable value (pegged to USD)",
              ],
              howToStart: [
                "1. Set X402_CHAIN=arbitrum",
                "2. Fund wallet with USDs on Arbitrum",
                "3. All x402 payments automatically earn yield",
                "4. Use yield_projection to see growth",
                "5. Use yield_report for monthly summaries",
              ],
              links: {
                sperax: "https://sperax.io",
                arbitrum: "https://arbitrum.io",
                docs: "https://docs.sperax.io",
              },
            }, null, 2),
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )
}
