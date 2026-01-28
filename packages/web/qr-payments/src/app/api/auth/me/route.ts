/**
 * Auth API - Current User
 * @description Get current authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import * as jose from 'jose';
import { users } from '../signin/route';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'agenti-jwt-secret-change-in-production'
);

interface JWTPayload {
  userId: string;
  email: string;
  tier: string;
}

export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);

    // Verify token using jose
    let payload: JWTPayload;
    try {
      const { payload: jwtPayload } = await jose.jwtVerify(token, JWT_SECRET);
      payload = jwtPayload as unknown as JWTPayload;
    } catch (err) {
      if (err instanceof jose.errors.JWTExpired) {
        return NextResponse.json(
          { error: 'Token expired' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get user from store
    const user = users.get(payload.userId);
    
    // If user not in memory, return from token payload
    // (In production, always fetch from database)
    const userData = user || {
      id: payload.userId,
      email: payload.email,
      username: payload.email.split('@')[0],
      tier: payload.tier,
    };

    return NextResponse.json({
      user: {
        id: userData.id,
        email: userData.email,
        username: userData.username,
        tier: userData.tier,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Failed to get user' },
      { status: 500 }
    );
  }
}
