/**
 * MCP Hosting Platform - Database Service
 * @description Prisma-backed persistence layer replacing in-memory Maps
 * @author nirholas
 */

import { PrismaClient } from "@prisma/client";
import type {
  HostedMCPServer,
  HostedMCPTool,
  HostedMCPPrompt,
  HostedMCPResource,
} from "./types.js";

// ---------------------------------------------------------------------------
// Singleton Prisma Client
// ---------------------------------------------------------------------------

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// ---------------------------------------------------------------------------
// Helpers – map DB rows back to the application-level interfaces
// ---------------------------------------------------------------------------

type ServerWithRelations = Awaited<
  ReturnType<typeof prisma.hostedServer.findUnique<{
    include: { tools: true; prompts: true; resources: true };
  }>>
>;

function toHostedTool(row: NonNullable<ServerWithRelations>["tools"][number]): HostedMCPTool {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    inputSchema: JSON.parse(row.inputSchema) as Record<string, unknown>,
    type: row.type as HostedMCPTool["type"],
    endpoint: row.endpoint ?? undefined,
    code: row.code ?? undefined,
    proxyTarget: row.proxyTarget ?? undefined,
    price: row.price,
    rateLimit:
      row.rateLimitRequests != null && row.rateLimitWindow != null
        ? { requests: row.rateLimitRequests, window: row.rateLimitWindow }
        : undefined,
    enabled: row.enabled,
  };
}

function toHostedPrompt(row: NonNullable<ServerWithRelations>["prompts"][number]): HostedMCPPrompt {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    template: row.template,
    arguments: JSON.parse(row.arguments) as HostedMCPPrompt["arguments"],
    price: row.price,
    enabled: row.enabled,
  };
}

function toHostedResource(row: NonNullable<ServerWithRelations>["resources"][number]): HostedMCPResource {
  return {
    id: row.id,
    uri: row.uri,
    name: row.name,
    description: row.description,
    mimeType: row.mimeType,
    type: row.type as HostedMCPResource["type"],
    content: row.content ?? undefined,
    endpoint: row.endpoint ?? undefined,
    price: row.price,
    enabled: row.enabled,
  };
}

function toHostedServer(row: NonNullable<ServerWithRelations>): HostedMCPServer {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description,
    subdomain: row.subdomain,
    customDomain: row.customDomain ?? undefined,
    status: row.status as HostedMCPServer["status"],
    tools: row.tools.map(toHostedTool),
    prompts: row.prompts.map(toHostedPrompt),
    resources: row.resources.map(toHostedResource),
    // Pricing is not stored in its own table – provide sensible defaults.
    // In a future iteration this could be a separate model or JSON column.
    pricing: {
      defaultToolPrice: 0,
      creatorShare: 85,
      acceptedPayments: ["x402"],
    },
    totalCalls: row.totalCalls,
    totalRevenue: row.totalRevenue,
    callsThisMonth: row.callsThisMonth,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up a hosted server (with tools, prompts, resources) by its subdomain.
 */
export async function getServerBySubdomain(
  subdomain: string
): Promise<HostedMCPServer | null> {
  const row = await prisma.hostedServer.findUnique({
    where: { subdomain },
    include: { tools: true, prompts: true, resources: true },
  });
  return row ? toHostedServer(row) : null;
}

/**
 * Increment call counters for a server.
 */
export async function incrementCallCount(serverId: string): Promise<void> {
  await prisma.hostedServer.update({
    where: { id: serverId },
    data: {
      totalCalls: { increment: 1 },
      callsThisMonth: { increment: 1 },
    },
  });
}

/**
 * Write a usage log entry.
 */
export async function logUsage(log: {
  serverId: string;
  userId: string;
  toolName: string;
  timestamp: Date;
  responseTime: number;
  success: boolean;
  paymentAmount?: number;
  paymentTxHash?: string;
  error?: string;
}): Promise<void> {
  await prisma.usageLog.create({
    data: {
      serverId: log.serverId,
      userId: log.userId,
      toolName: log.toolName,
      timestamp: log.timestamp,
      responseTime: log.responseTime,
      success: log.success,
      paymentAmount: log.paymentAmount ?? null,
      paymentTxHash: log.paymentTxHash ?? null,
      error: log.error ?? null,
    },
  });
}

/**
 * Check whether a subdomain is available (not yet registered).
 */
export async function isSubdomainAvailable(
  subdomain: string
): Promise<boolean> {
  const existing = await prisma.hostedServer.findUnique({
    where: { subdomain },
    select: { id: true },
  });
  return existing === null;
}

/**
 * Create a new hosted server record (with optional nested tools/prompts/resources).
 */
export async function createServer(data: {
  userId: string;
  name: string;
  description?: string;
  subdomain: string;
  customDomain?: string;
  status?: string;
  tools?: Array<Omit<HostedMCPTool, "id">>;
  prompts?: Array<Omit<HostedMCPPrompt, "id">>;
  resources?: Array<Omit<HostedMCPResource, "id">>;
}): Promise<HostedMCPServer> {
  const row = await prisma.hostedServer.create({
    data: {
      userId: data.userId,
      name: data.name,
      description: data.description ?? "",
      subdomain: data.subdomain,
      customDomain: data.customDomain ?? null,
      status: data.status ?? "active",
      tools: data.tools
        ? {
            create: data.tools.map((t) => ({
              name: t.name,
              description: t.description,
              inputSchema: JSON.stringify(t.inputSchema),
              type: t.type,
              endpoint: t.endpoint ?? null,
              code: t.code ?? null,
              proxyTarget: t.proxyTarget ?? null,
              price: t.price,
              rateLimitRequests: t.rateLimit?.requests ?? null,
              rateLimitWindow: t.rateLimit?.window ?? null,
              enabled: t.enabled,
            })),
          }
        : undefined,
      prompts: data.prompts
        ? {
            create: data.prompts.map((p) => ({
              name: p.name,
              description: p.description,
              template: p.template,
              arguments: JSON.stringify(p.arguments),
              price: p.price,
              enabled: p.enabled,
            })),
          }
        : undefined,
      resources: data.resources
        ? {
            create: data.resources.map((r) => ({
              uri: r.uri,
              name: r.name,
              description: r.description,
              mimeType: r.mimeType,
              type: r.type,
              content: r.content ?? null,
              endpoint: r.endpoint ?? null,
              price: r.price,
              enabled: r.enabled,
            })),
          }
        : undefined,
    },
    include: { tools: true, prompts: true, resources: true },
  });
  return toHostedServer(row);
}

/**
 * Update an existing server (shallow fields only – tools/prompts/resources
 * should be managed through their own CRUD endpoints).
 */
export async function updateServer(
  id: string,
  data: Partial<
    Pick<
      HostedMCPServer,
      "name" | "description" | "customDomain" | "status" | "totalRevenue"
    >
  >
): Promise<HostedMCPServer> {
  const row = await prisma.hostedServer.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.customDomain !== undefined && { customDomain: data.customDomain }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.totalRevenue !== undefined && { totalRevenue: data.totalRevenue }),
    },
    include: { tools: true, prompts: true, resources: true },
  });
  return toHostedServer(row);
}

/**
 * List all servers owned by a user.
 */
export async function getServersByUser(
  userId: string
): Promise<HostedMCPServer[]> {
  const rows = await prisma.hostedServer.findMany({
    where: { userId },
    include: { tools: true, prompts: true, resources: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toHostedServer);
}

/**
 * Aggregate usage statistics for a server.
 */
export async function getUsageStats(serverId: string): Promise<{
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  avgResponseTime: number;
  totalRevenue: number;
}> {
  const [aggregates, server] = await Promise.all([
    prisma.usageLog.aggregate({
      where: { serverId },
      _count: { id: true },
      _avg: { responseTime: true },
      _sum: { paymentAmount: true },
    }),
    prisma.usageLog.count({
      where: { serverId, success: true },
    }),
  ]);

  return {
    totalCalls: aggregates._count.id,
    successfulCalls: server,
    failedCalls: aggregates._count.id - server,
    avgResponseTime: Math.round(aggregates._avg.responseTime ?? 0),
    totalRevenue: aggregates._sum.paymentAmount ?? 0,
  };
}

export default {
  prisma,
  getServerBySubdomain,
  incrementCallCount,
  logUsage,
  isSubdomainAvailable,
  createServer,
  updateServer,
  getServersByUser,
  getUsageStats,
};
