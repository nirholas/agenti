import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  authenticateRequest,
  unauthorizedResponse,
  forbiddenResponse,
  badRequestResponse,
  notFoundResponse,
  successResponse,
  createdResponse,
} from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Validation schema for creating tools
const createToolSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, 'Tool name must be lowercase alphanumeric with underscores'),
  description: z.string().max(1000).optional(),
  inputSchema: z.record(z.any()).default({}),
  type: z.enum(['HTTP', 'CODE', 'PROXY']).default('HTTP'),
  endpoint: z.string().url().optional().nullable(),
  code: z.string().max(100000).optional().nullable(),
  proxyTarget: z.string().url().optional().nullable(),
  price: z.number().min(0).default(0),
  rateLimit: z.object({
    requests: z.number().int().positive().optional(),
    window: z.number().int().positive().optional(), // in seconds
  }).optional().nullable(),
  enabled: z.boolean().default(true),
});

/**
 * GET /api/servers/[id]/tools - List all tools for a server
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await authenticateRequest(request);
  if (!user) {
    return unauthorizedResponse();
  }

  const { id } = await params;

  // Find the server
  const server = await prisma.mCPServer.findUnique({
    where: { id },
  });

  if (!server) {
    return notFoundResponse('Server not found');
  }

  // Check ownership
  if (server.userId !== user.id) {
    return forbiddenResponse('You do not have access to this server');
  }

  const { searchParams } = new URL(request.url);
  const enabled = searchParams.get('enabled');

  const where: { serverId: string; enabled?: boolean } = { serverId: id };
  if (enabled !== null) {
    where.enabled = enabled === 'true';
  }

  const tools = await prisma.mCPTool.findMany({
    where,
    orderBy: { name: 'asc' },
  });

  return successResponse({ tools });
}

/**
 * POST /api/servers/[id]/tools - Create a new tool
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await authenticateRequest(request);
  if (!user) {
    return unauthorizedResponse();
  }

  const { id } = await params;

  // Find the server
  const server = await prisma.mCPServer.findUnique({
    where: { id },
  });

  if (!server) {
    return notFoundResponse('Server not found');
  }

  // Check ownership
  if (server.userId !== user.id) {
    return forbiddenResponse('You do not have access to this server');
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequestResponse('Invalid JSON body');
  }

  const validation = createToolSchema.safeParse(body);
  if (!validation.success) {
    return badRequestResponse('Validation failed', validation.error.flatten());
  }

  const data = validation.data;

  // Validate type-specific fields
  if (data.type === 'HTTP' && !data.endpoint) {
    return badRequestResponse('HTTP tools require an endpoint URL');
  }
  if (data.type === 'CODE' && !data.code) {
    return badRequestResponse('CODE tools require code content');
  }
  if (data.type === 'PROXY' && !data.proxyTarget) {
    return badRequestResponse('PROXY tools require a proxy target URL');
  }

  // Check tool name uniqueness within server
  const existingTool = await prisma.mCPTool.findUnique({
    where: {
      serverId_name: {
        serverId: id,
        name: data.name,
      },
    },
  });

  if (existingTool) {
    return badRequestResponse('A tool with this name already exists in this server');
  }

  const tool = await prisma.mCPTool.create({
    data: {
      serverId: id,
      name: data.name,
      description: data.description,
      inputSchema: data.inputSchema,
      type: data.type,
      endpoint: data.endpoint,
      code: data.code,
      proxyTarget: data.proxyTarget,
      price: data.price,
      rateLimit: data.rateLimit,
      enabled: data.enabled,
    },
  });

  return createdResponse(tool);
}
