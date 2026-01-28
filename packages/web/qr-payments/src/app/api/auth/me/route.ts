/**
 * Auth API - Current User
 * @description Get current authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'agenti-jwt-secret-change-in-production';

// TODO: Import from database
const users = new Map<string, {
  id: string;
  email: string;
  username: string;
  tier: string;
  stripeCustomerId?: string;
}>();

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

    // Verify token
    let payload: JWTPayload;
    try {
      payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
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
        stripeCustomerId: user?.stripeCustomerId,
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
