import { NextRequest } from 'next/server';
import { prisma } from './prisma';
import * as jose from 'jose';

// Type that matches MCPUser from Prisma schema
export interface MCPUser {
  id: string;
  email: string;
  passwordHash: string;
  tier: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  apiKey: string;
  apiKeyHash: string;
  requestCount: number;
  lastRequestAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'agenti-mcp-hosting-secret-key-change-in-production'
);

export interface JWTPayload {
  userId: string;
  email: string;
  tier: string;
}

/**
 * Sign a JWT token for a user
 */
export async function signToken(user: MCPUser): Promise<string> {
  const jwt = await new jose.SignJWT({
    userId: user.id,
    email: user.email,
    tier: user.tier,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
  
  return jwt;
}

/**
 * Verify a JWT token and return the payload
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Extract Bearer token from Authorization header
 */
export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Authenticate request and return the user
 */
export async function authenticateRequest(request: NextRequest): Promise<MCPUser | null> {
  const token = extractBearerToken(request);
  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return null;
  }

  const user = await prisma.mCPUser.findUnique({
    where: { id: payload.userId },
  });

  return user;
}

/**
 * Helper to create unauthorized response
 */
export function unauthorizedResponse(message = 'Unauthorized') {
  return Response.json(
    { error: message },
    { status: 401 }
  );
}

/**
 * Helper to create forbidden response
 */
export function forbiddenResponse(message = 'Forbidden') {
  return Response.json(
    { error: message },
    { status: 403 }
  );
}

/**
 * Helper to create bad request response
 */
export function badRequestResponse(message: string, errors?: unknown) {
  return Response.json(
    { error: message, errors },
    { status: 400 }
  );
}

/**
 * Helper to create not found response
 */
export function notFoundResponse(message = 'Not found') {
  return Response.json(
    { error: message },
    { status: 404 }
  );
}

/**
 * Helper to create success response
 */
export function successResponse<T>(data: T, status = 200) {
  return Response.json(data, { status });
}

/**
 * Helper to create created response
 */
export function createdResponse<T>(data: T) {
  return Response.json(data, { status: 201 });
}
