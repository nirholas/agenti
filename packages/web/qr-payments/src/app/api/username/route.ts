import { NextRequest, NextResponse } from 'next/server';
import { 
  registerUsername, 
  resolveUsername, 
  getProfileByUsername 
} from '@/lib/username/registry';

// GET - Resolve username to address
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get('username');

  if (!username) {
    return NextResponse.json(
      { error: 'Username required' },
      { status: 400 }
    );
  }

  const profile = getProfileByUsername(username);
  
  if (!profile) {
    return NextResponse.json(
      { error: 'Username not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    username: profile.username,
    address: profile.walletAddress,
    verified: profile.xVerified,
  });
}

// POST - Register new username
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, walletAddress, xVerificationToken } = body;

    if (!username || !walletAddress || !xVerificationToken) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate username format
    const usernameRegex = /^[a-zA-Z0-9_]{1,15}$/;
    if (!usernameRegex.test(username.replace('@', ''))) {
      return NextResponse.json(
        { error: 'Invalid username format' },
        { status: 400 }
      );
    }

    // Validate wallet address
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!addressRegex.test(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    const profile = await registerUsername(
      username,
      walletAddress,
      xVerificationToken
    );

    return NextResponse.json({
      success: true,
      profile: {
        username: profile.username,
        address: profile.walletAddress,
        verified: profile.xVerified,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
