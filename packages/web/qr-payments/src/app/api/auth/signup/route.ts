/**
 * Auth API - Sign Up
 * @description Create new user account
 */

import { NextRequest, NextResponse } from 'next/server';
import * as jose from 'jose';
import { hashPassword, users, emailToId } from '../signin/route';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'agenti-jwt-secret-change-in-production'
);

interface SignUpRequest {
  email: string;
  password: string;
  username?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SignUpRequest;
    const { email, password, username } = body;

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if email exists
    if (emailToId.has(email.toLowerCase())) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Validate password
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Hash password using Web Crypto API
    const passwordHash = await hashPassword(password);

    // Generate user ID and username
    const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const finalUsername = username || email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') + Math.random().toString(36).substr(2, 4);

    // Create user
    const user = {
      id,
      email: email.toLowerCase(),
      username: finalUsername,
      passwordHash,
      tier: 'free',
      createdAt: new Date(),
    };

    users.set(id, user);
    emailToId.set(email.toLowerCase(), id);

    // Generate JWT using jose
    const token = await new jose.SignJWT({ userId: id, email: user.email, tier: user.tier })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(JWT_SECRET);

    console.log('User signed up:', { id, email: user.email });

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
    console.error('Sign up error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
