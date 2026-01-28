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
  params: Promise<{ id: string }>;
}

// Validation schema for updates
const updateServerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  subdomain: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/, 'Subdomain must be lowercase alphanumeric with hyphens').optional(),
  customDomain: z.string().url().optional().nullable(),
  status: z.enum(['ACTIVE', 'PAUSED', 'SUSPENDED']).optional(),
  payoutAddress: z.string().optional().nullable(),
  creatorShare: z.number().int().min(0).max(100).optional(),
});

/**
 * GET /api/servers/[id] - Get a specific server
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await authenticateRequest(request);
  if (!user) {
    return unauthorizedResponse();
  }

  const { id } = await params;

  const server = await prisma.mCPServer.findUnique({
    where: { id },
    include: {
      tools: {
        orderBy: { name: 'asc' },
      },
      prompts: {
        orderBy: { name: 'asc' },
      },
      resources: {
        orderBy: { name: 'asc' },
      },
      _count: {
        select: { tools: true, prompts: true, resources: true, usageLogs: true },
      },
    },
  });

  if (!server) {
    return notFoundResponse('Server not found');
  }

  // Check ownership
  if (server.userId !== user.id) {
    return forbiddenResponse('You do not have access to this server');
  }

  return successResponse(server);
}

/**
 * PUT /api/servers/[id] - Update a server
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

  const validation = updateServerSchema.safeParse(body);
  if (!validation.success) {
    return badRequestResponse('Validation failed', validation.error.flatten());
  }

  const data = validation.data;

  // Check subdomain uniqueness if changing
  if (data.subdomain && data.subdomain !== server.subdomain) {
    const existingSubdomain = await prisma.mCPServer.findUnique({
      where: { subdomain: data.subdomain },
    });

    if (existingSubdomain) {
      return badRequestResponse('Subdomain is already taken');
    }
  }

  // Check custom domain uniqueness if changing
  if (data.customDomain && data.customDomain !== server.customDomain) {
    const existingDomain = await prisma.mCPServer.findUnique({
      where: { customDomain: data.customDomain },
    });

    if (existingDomain) {
      return badRequestResponse('Custom domain is already in use');
    }
  }

  const updatedServer = await prisma.mCPServer.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.subdomain && { subdomain: data.subdomain }),
      ...(data.customDomain !== undefined && { customDomain: data.customDomain }),
      ...(data.status && { status: data.status }),
      ...(data.payoutAddress !== undefined && { payoutAddress: data.payoutAddress }),
      ...(data.creatorShare !== undefined && { creatorShare: data.creatorShare }),
    },
    include: {
      _count: {
        select: { tools: true, prompts: true, resources: true },
      },
    },
  });

  return successResponse(updatedServer);
}

/**
 * DELETE /api/servers/[id] - Delete a server
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

  // Delete the server (cascade will delete tools, prompts, resources, usage logs)
  await prisma.mCPServer.delete({
    where: { id },
  });

  return successResponse({ message: 'Server deleted successfully' });
}
