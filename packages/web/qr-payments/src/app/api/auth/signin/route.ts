/**
 * Auth API - Sign In
 * @description Authenticate existing user
 */

import { NextRequest, NextResponse } from 'next/server';
import * as jose from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'agenti-jwt-secret-change-in-production'
);

// Simple hash function for passwords (in production, use a proper KDF like Argon2)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'agenti-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computedHash = await hashPassword(password);
  return computedHash === hash;
}

// TODO: Replace with database (Prisma)
// Import from shared store (in production, this would be the database)
// For now, recreate the in-memory store (would be shared in real app)
const users = new Map<string, {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  tier: string;
  createdAt: Date;
}>();

const emailToId = new Map<string, string>();

interface SignInRequest {
  email: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SignInRequest;
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find user by email
    const userId = emailToId.get(email.toLowerCase());
    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const user = users.get(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password
    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Generate JWT using jose
    const token = await new jose.SignJWT({ userId: user.id, email: user.email, tier: user.tier })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(JWT_SECRET);

    console.log('User signed in:', { id: user.id, email: user.email });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        tier: user.tier,
      },
      token,
    });
  } catch (error) {
    console.error('Sign in error:', error);
    return NextResponse.json(
      { error: 'Failed to sign in' },
      { status: 500 }
    );
  }
}

// Export for sharing with signup route
export { users, emailToId, hashPassword, verifyPassword };
