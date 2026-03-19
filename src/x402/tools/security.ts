/**
 * x402 Security Tools
 * @description Security tools: payment limits, allowlist management, payment history, security status
 * @author nirholas
 * @license Apache-2.0
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { LegacyConfig, FullConfig } from "./shared.js"

export function registerSecurityTools(server: McpServer, config: LegacyConfig, fullConfig: FullConfig): void {

  // Tool 23: x402_set_payment_limit - Configure payment limits
  server.tool(
    "x402_set_payment_limit",
    "Set payment limits for security. Configure maximum single payment and daily spending limits.",
    {
      maxSinglePayment: z.number().positive().optional().describe("Maximum single payment in USD (e.g. 5.00)"),
      maxDailyPayment: z.number().positive().optional().describe("Maximum daily spending in USD (e.g. 50.00)"),
      largePaymentWarning: z.number().positive().optional().describe("Threshold for large payment warnings"),
    },
    async ({ maxSinglePayment, maxDailyPayment, largePaymentWarning }) => {
      try {
        const { setPaymentLimits, getPaymentLimits, DEFAULT_LIMITS } = await import("../limits.js")

        const newLimits = setPaymentLimits({
          maxSinglePayment,
          maxDailyPayment,
          largePaymentWarning,
        })

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              limits: newLimits,
              absoluteLimits: {
                maxSingle: DEFAULT_LIMITS.ABSOLUTE_MAX_SINGLE,
                maxDaily: DEFAULT_LIMITS.ABSOLUTE_MAX_DAILY,
                note: "These are hard caps that cannot be exceeded",
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

  // Tool 24: x402_get_payment_limits - Get current payment limits
  server.tool(
    "x402_get_payment_limits",
    "Get current payment limits and daily spending status.",
    {},
    async () => {
      try {
        const { getPaymentLimits, getDailySpending, DEFAULT_LIMITS } = await import("../limits.js")

        const limits = getPaymentLimits()
        const dailySpending = getDailySpending()

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              limits: {
                maxSinglePayment: `$${limits.maxSinglePayment.toFixed(2)}`,
                maxDailyPayment: `$${limits.maxDailyPayment.toFixed(2)}`,
                largePaymentWarning: `$${limits.largePaymentWarning.toFixed(2)}`,
              },
              dailySpending: {
                date: dailySpending.date,
                spent: `$${dailySpending.total.toFixed(2)}`,
                remaining: `$${dailySpending.remaining.toFixed(2)}`,
                paymentCount: dailySpending.count,
              },
              absoluteLimits: {
                maxSingle: `$${DEFAULT_LIMITS.ABSOLUTE_MAX_SINGLE}`,
                maxDaily: `$${DEFAULT_LIMITS.ABSOLUTE_MAX_DAILY}`,
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

  // Tool 25: x402_list_approved_services - Show allowlisted services
  server.tool(
    "x402_list_approved_services",
    "List all approved services in the payment allowlist.",
    {},
    async () => {
      try {
        const { getApprovedServices, isStrictAllowlistMode } = await import("../limits.js")

        const services = getApprovedServices()
        const strictMode = isStrictAllowlistMode()

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              strictMode: strictMode,
              strictModeDescription: strictMode
                ? "Only approved services can receive payments"
                : "Unknown services allowed with warnings",
              approvedServices: services.map(s => ({
                domain: s.domain,
                name: s.name,
                maxPayment: s.maxPayment ? `$${s.maxPayment.toFixed(2)}` : "No limit",
                addedAt: s.addedAt.toISOString(),
              })),
              count: services.length,
              tip: strictMode
                ? "Use x402_approve_service to add trusted services"
                : "Set X402_STRICT_ALLOWLIST=true for stricter security",
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

  // Tool 26: x402_approve_service - Add service to allowlist
  server.tool(
    "x402_approve_service",
    "Approve a service domain for x402 payments. Required in strict allowlist mode.",
    {
      domain: z.string().describe("Domain to approve (e.g. 'api.example.com')"),
      name: z.string().optional().describe("Friendly name for the service"),
      maxPayment: z.number().positive().optional().describe("Maximum payment for this service"),
    },
    async ({ domain, name, maxPayment }) => {
      try {
        const { approveService, getApprovedServices } = await import("../limits.js")

        const service = approveService(domain, name, maxPayment)
        const totalServices = getApprovedServices().length

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              approved: {
                domain: service.domain,
                name: service.name,
                maxPayment: service.maxPayment ? `$${service.maxPayment.toFixed(2)}` : "No limit",
                addedAt: service.addedAt.toISOString(),
              },
              totalApprovedServices: totalServices,
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

  // Tool 27: x402_remove_service - Remove service from allowlist
  server.tool(
    "x402_remove_service",
    "Remove a service from the approved allowlist.",
    {
      domain: z.string().describe("Domain to remove (e.g. 'api.example.com')"),
    },
    async ({ domain }) => {
      try {
        const { removeService, getApprovedServices } = await import("../limits.js")

        const removed = removeService(domain)
        const totalServices = getApprovedServices().length

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: removed,
              domain,
              message: removed ? "Service removed from allowlist" : "Service was not in allowlist",
              totalApprovedServices: totalServices,
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

  // Tool 28: x402_get_payment_history - Get audit trail
  server.tool(
    "x402_get_payment_history",
    "Get payment history for audit and review. Shows recent payments with details.",
    {
      limit: z.number().default(20).describe("Maximum number of entries to return"),
      service: z.string().optional().describe("Filter by service domain"),
      status: z.enum(["pending", "completed", "failed"]).optional().describe("Filter by status"),
    },
    async ({ limit, service, status }) => {
      try {
        const { getPaymentHistory, getPaymentStats, getDailySpending } = await import("../limits.js")

        const history = getPaymentHistory({ limit, service, status })
        const stats = getPaymentStats()
        const dailySpending = getDailySpending()

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              summary: {
                totalPayments: stats.count,
                totalSpent: `$${stats.total.toFixed(2)}`,
                averagePayment: `$${stats.avgAmount.toFixed(2)}`,
                todaySpent: `$${dailySpending.total.toFixed(2)}`,
                todayRemaining: `$${dailySpending.remaining.toFixed(2)}`,
              },
              byStatus: stats.byStatus,
              recentPayments: history.map(p => ({
                id: p.id,
                timestamp: p.timestamp.toISOString(),
                amount: `$${p.amount.toFixed(2)}`,
                token: p.token,
                recipient: p.recipient,
                service: p.service,
                status: p.status,
                txHash: p.txHash || null,
                chain: p.chain,
                gasless: p.gasless,
              })),
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

  // Tool 29: x402_security_status - Overall security status
  server.tool(
    "x402_security_status",
    "Get comprehensive security status including limits, allowlist, and recent security events.",
    {},
    async () => {
      try {
        const { getPaymentLimits, getDailySpending, isStrictAllowlistMode, getApprovedServices } = await import("../limits.js")
        const { getSecurityEvents, isKeySourceSecure, isTestnetOnly } = await import("../security.js")

        const limits = getPaymentLimits()
        const dailySpending = getDailySpending()
        const services = getApprovedServices()
        const recentEvents = getSecurityEvents(10)
        const keySecure = isKeySourceSecure()
        const testnetOnly = isTestnetOnly()

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              security: {
                keySourceSecure: keySecure.secure,
                keyWarnings: keySecure.warnings,
                testnetOnly: testnetOnly,
                strictAllowlist: isStrictAllowlistMode(),
                mainnetEnabled: config.mainnetEnabled ?? false,
              },
              limits: {
                maxSinglePayment: `$${limits.maxSinglePayment.toFixed(2)}`,
                maxDailyPayment: `$${limits.maxDailyPayment.toFixed(2)}`,
                largePaymentWarning: `$${limits.largePaymentWarning.toFixed(2)}`,
              },
              dailySpending: {
                date: dailySpending.date,
                spent: `$${dailySpending.total.toFixed(2)}`,
                remaining: `$${dailySpending.remaining.toFixed(2)}`,
                percentUsed: ((dailySpending.total / limits.maxDailyPayment) * 100).toFixed(1) + "%",
              },
              allowlist: {
                approvedServices: services.length,
                services: services.map(s => s.domain).slice(0, 5),
              },
              recentSecurityEvents: recentEvents.map(e => ({
                timestamp: e.timestamp.toISOString(),
                event: e.event,
                severity: e.severity,
              })),
              recommendations: [
                ...(keySecure.warnings.length > 0 ? ["Review key security warnings"] : []),
                ...(dailySpending.remaining < limits.maxDailyPayment * 0.2 ? ["Daily spending limit nearly reached"] : []),
                ...(!isStrictAllowlistMode() ? ["Consider enabling strict allowlist mode for production"] : []),
              ],
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
