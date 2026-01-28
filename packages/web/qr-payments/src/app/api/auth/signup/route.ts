/**
 * Auth API - Sign Up
 * @description Create new user account
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'agenti-jwt-secret-change-in-production';
const BCRYPT_ROUNDS = 12;

// TODO: Replace with database (Prisma)
// In-memory storage for development
const users = new Map<string, {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  tier: string;
  createdAt: Date;
}>();

const emailToId = new Map<string, string>();

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

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

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

    // Generate JWT
    const token = jwt.sign(
      { userId: id, email: user.email, tier: user.tier },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

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

// Export users map for use in other auth routes
export { users, emailToId };
