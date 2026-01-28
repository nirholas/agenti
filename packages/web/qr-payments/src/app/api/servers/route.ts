import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  authenticateRequest,
  unauthorizedResponse,
  badRequestResponse,
  successResponse,
  createdResponse,
} from '@/lib/auth';

// Validation schemas
const createServerSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  subdomain: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/, 'Subdomain must be lowercase alphanumeric with hyphens'),
  customDomain: z.string().url().optional().nullable(),
  payoutAddress: z.string().optional().nullable(),
  creatorShare: z.number().int().min(0).max(100).optional().default(85),
});

/**
 * GET /api/servers - List all servers for the authenticated user
 */
export async function GET(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (!user) {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');

  const where: { userId: string; status?: 'ACTIVE' | 'PAUSED' | 'SUSPENDED' } = { userId: user.id };
  if (status && ['ACTIVE', 'PAUSED', 'SUSPENDED'].includes(status.toUpperCase())) {
    where.status = status.toUpperCase() as 'ACTIVE' | 'PAUSED' | 'SUSPENDED';
  }

  const [servers, total] = await Promise.all([
    prisma.mCPServer.findMany({
      where,
      include: {
        _count: {
          select: { tools: true, prompts: true, resources: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.mCPServer.count({ where }),
  ]);

  return successResponse({
    servers,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + servers.length < total,
    },
  });
}

/**
 * POST /api/servers - Create a new server
 */
export async function POST(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (!user) {
    return unauthorizedResponse();
  }

  // Check server limits based on tier
  const serverCounts = await prisma.mCPServer.count({
    where: { userId: user.id },
  });

  const tierLimits: Record<string, number> = {
    FREE: 1,
    PRO: 5,
    BUSINESS: 20,
    ENTERPRISE: 100,
  };

  const limit = tierLimits[user.tier] || 1;
  if (serverCounts >= limit) {
    return badRequestResponse(
      `Server limit reached. Your ${user.tier.toLowerCase()} tier allows ${limit} server(s). Upgrade to create more.`
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return badRequestResponse('Invalid JSON body');
  }

  const validation = createServerSchema.safeParse(body);
  if (!validation.success) {
    return badRequestResponse('Validation failed', validation.error.flatten());
  }

  const data = validation.data;

  // Check if subdomain is already taken
  const existingSubdomain = await prisma.mCPServer.findUnique({
    where: { subdomain: data.subdomain },
  });

  if (existingSubdomain) {
    return badRequestResponse('Subdomain is already taken');
  }

  // Check if custom domain is already taken
  if (data.customDomain) {
    const existingDomain = await prisma.mCPServer.findUnique({
      where: { customDomain: data.customDomain },
    });

    if (existingDomain) {
      return badRequestResponse('Custom domain is already in use');
    }
  }

  const server = await prisma.mCPServer.create({
    data: {
      userId: user.id,
      name: data.name,
      description: data.description,
      subdomain: data.subdomain,
      customDomain: data.customDomain,
      payoutAddress: data.payoutAddress,
      creatorShare: data.creatorShare,
    },
    include: {
      _count: {
        select: { tools: true, prompts: true, resources: true },
      },
    },
  });

  return createdResponse(server);
}
