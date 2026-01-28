import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  authenticateRequest,
  unauthorizedResponse,
  successResponse,
} from '@/lib/auth';

/**
 * GET /api/users/me - Get current authenticated user profile
 */
export async function GET(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (!user) {
    return unauthorizedResponse();
  }

  // Get user with stats
  const userWithStats = await prisma.mCPUser.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      username: true,
      tier: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { servers: true },
      },
    },
  });

  if (!userWithStats) {
    return unauthorizedResponse('User not found');
  }

  // Get aggregated stats from all user's servers
  const serverStats = await prisma.mCPServer.aggregate({
    where: { userId: user.id },
    _sum: {
      totalCalls: true,
      totalRevenue: true,
      callsThisMonth: true,
    },
  });

  // Get tier limits
  const tierLimits: Record<string, { servers: number; toolsPerServer: number; callsPerMonth: number }> = {
    FREE: { servers: 1, toolsPerServer: 5, callsPerMonth: 1000 },
    PRO: { servers: 5, toolsPerServer: 25, callsPerMonth: 50000 },
    BUSINESS: { servers: 20, toolsPerServer: 100, callsPerMonth: 500000 },
    ENTERPRISE: { servers: 100, toolsPerServer: -1, callsPerMonth: -1 }, // -1 means unlimited
  };

  const limits = tierLimits[userWithStats.tier] || tierLimits.FREE;

  return successResponse({
    user: {
      id: userWithStats.id,
      email: userWithStats.email,
      username: userWithStats.username,
      tier: userWithStats.tier,
      hasStripeSubscription: !!userWithStats.stripeSubscriptionId,
      createdAt: userWithStats.createdAt,
      updatedAt: userWithStats.updatedAt,
    },
    stats: {
      serverCount: userWithStats._count.servers,
      totalCalls: serverStats._sum.totalCalls || 0,
      totalRevenue: serverStats._sum.totalRevenue?.toString() || '0',
      callsThisMonth: serverStats._sum.callsThisMonth || 0,
    },
    limits: {
      maxServers: limits.servers,
      maxToolsPerServer: limits.toolsPerServer,
      maxCallsPerMonth: limits.callsPerMonth,
      serversUsed: userWithStats._count.servers,
      serversRemaining: limits.servers === -1 ? -1 : Math.max(0, limits.servers - userWithStats._count.servers),
    },
  });
}
