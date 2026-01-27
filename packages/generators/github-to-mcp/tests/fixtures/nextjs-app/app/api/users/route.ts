/**
 * Next.js App Router API route for testing - Users
 */
import { NextRequest, NextResponse } from 'next/server';

interface User {
  id: string;
  name: string;
  email: string;
}

/**
 * Get all users
 * @tag Users
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = searchParams.get('limit') || '10';
  const offset = searchParams.get('offset') || '0';
  
  const users: User[] = [];
  
  return NextResponse.json({
    users,
    limit: parseInt(limit),
    offset: parseInt(offset),
  });
}

/**
 * Create a new user
 * @tag Users
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  const user: User = {
    id: crypto.randomUUID(),
    name: body.name,
    email: body.email,
  };
  
  return NextResponse.json(user, { status: 201 });
}
