/**
 * Next.js App Router API route for testing - Single User
 */
import { NextRequest, NextResponse } from 'next/server';

interface User {
  id: string;
  name: string;
  email: string;
}

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * Get user by ID
 * @tag Users
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const user: User = {
    id: params.id,
    name: 'Test User',
    email: 'test@example.com',
  };
  
  return NextResponse.json(user);
}

/**
 * Update user
 * @tag Users
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  const body = await request.json();
  
  const user: User = {
    id: params.id,
    name: body.name,
    email: body.email,
  };
  
  return NextResponse.json(user);
}

/**
 * Delete user
 * @tag Users
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  return new NextResponse(null, { status: 204 });
}
