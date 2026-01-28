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
} from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string; toolId: string }>;
}

// Validation schema for updating tools
const updateToolSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, 'Tool name must be lowercase alphanumeric with underscores').optional(),
  description: z.string().max(1000).optional().nullable(),
  inputSchema: z.record(z.any()).optional(),
  type: z.enum(['HTTP', 'CODE', 'PROXY']).optional(),
  endpoint: z.string().url().optional().nullable(),
  code: z.string().max(100000).optional().nullable(),
  proxyTarget: z.string().url().optional().nullable(),
  price: z.number().min(0).optional(),
  rateLimit: z.object({
    requests: z.number().int().positive().optional(),
    window: z.number().int().positive().optional(),
  }).optional().nullable(),
  enabled: z.boolean().optional(),
});

/**
 * GET /api/servers/[id]/tools/[toolId] - Get a specific tool
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await authenticateRequest(request);
  if (!user) {
    return unauthorizedResponse();
  }

  const { id, toolId } = await params;

  // Find the tool with its server
  const tool = await prisma.mCPTool.findUnique({
    where: { id: toolId },
    include: {
      server: {
        select: { id: true, userId: true, name: true },
      },
    },
  });

  if (!tool) {
    return notFoundResponse('Tool not found');
  }

  // Verify server ID matches
  if (tool.serverId !== id) {
    return notFoundResponse('Tool not found in this server');
  }

  // Check ownership
  if (tool.server.userId !== user.id) {
    return forbiddenResponse('You do not have access to this tool');
  }

  // Remove server from response
  const { server: _server, ...toolData } = tool;
  return successResponse(toolData);
}

/**
 * PUT /api/servers/[id]/tools/[toolId] - Update a tool
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await authenticateRequest(request);
  if (!user) {
    return unauthorizedResponse();
  }

  const { id, toolId } = await params;

  // Find the tool with its server
  const tool = await prisma.mCPTool.findUnique({
    where: { id: toolId },
    include: {
      server: {
        select: { id: true, userId: true },
      },
    },
  });

  if (!tool) {
    return notFoundResponse('Tool not found');
  }

  // Verify server ID matches
  if (tool.serverId !== id) {
    return notFoundResponse('Tool not found in this server');
  }

  // Check ownership
  if (tool.server.userId !== user.id) {
    return forbiddenResponse('You do not have access to this tool');
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequestResponse('Invalid JSON body');
  }

  const validation = updateToolSchema.safeParse(body);
  if (!validation.success) {
    return badRequestResponse('Validation failed', validation.error.flatten());
  }

  const data = validation.data;

  // Check name uniqueness if changing
  if (data.name && data.name !== tool.name) {
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
  }

  // Validate type-specific fields for the final state
  const finalType = data.type ?? tool.type;
  const finalEndpoint = data.endpoint !== undefined ? data.endpoint : tool.endpoint;
  const finalCode = data.code !== undefined ? data.code : tool.code;
  const finalProxyTarget = data.proxyTarget !== undefined ? data.proxyTarget : tool.proxyTarget;

  if (finalType === 'HTTP' && !finalEndpoint) {
    return badRequestResponse('HTTP tools require an endpoint URL');
  }
  if (finalType === 'CODE' && !finalCode) {
    return badRequestResponse('CODE tools require code content');
  }
  if (finalType === 'PROXY' && !finalProxyTarget) {
    return badRequestResponse('PROXY tools require a proxy target URL');
  }

  const updatedTool = await prisma.mCPTool.update({
    where: { id: toolId },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.inputSchema && { inputSchema: data.inputSchema }),
      ...(data.type && { type: data.type }),
      ...(data.endpoint !== undefined && { endpoint: data.endpoint }),
      ...(data.code !== undefined && { code: data.code }),
      ...(data.proxyTarget !== undefined && { proxyTarget: data.proxyTarget }),
      ...(data.price !== undefined && { price: data.price }),
      ...(data.rateLimit !== undefined && { rateLimit: data.rateLimit }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
    },
  });

  return successResponse(updatedTool);
}

/**
 * DELETE /api/servers/[id]/tools/[toolId] - Delete a tool
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await authenticateRequest(request);
  if (!user) {
    return unauthorizedResponse();
  }

  const { id, toolId } = await params;

  // Find the tool with its server
  const tool = await prisma.mCPTool.findUnique({
    where: { id: toolId },
    include: {
      server: {
        select: { id: true, userId: true },
      },
    },
  });

  if (!tool) {
    return notFoundResponse('Tool not found');
  }

  // Verify server ID matches
  if (tool.serverId !== id) {
    return notFoundResponse('Tool not found in this server');
  }

  // Check ownership
  if (tool.server.userId !== user.id) {
    return forbiddenResponse('You do not have access to this tool');
  }

  await prisma.mCPTool.delete({
    where: { id: toolId },
  });

  return successResponse({ message: 'Tool deleted successfully' });
}
