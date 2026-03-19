import { NextRequest, NextResponse } from 'next/server';
import { createCrossmint, CrossmintWallets } from "@crossmint/wallets-sdk";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    const apiKey = process.env.CROSSMINT_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Server configuration error: Crossmint API key not set' },
        { status: 500 }
      );
    }

    // Create wallet using backend API key
    const crossmint = createCrossmint({ apiKey });
    const wallets = CrossmintWallets.from(crossmint);
    const wallet = await wallets.createWallet({
      chain: 'base-sepolia' as any,
      signer: { type: 'api-key' as const },
      owner: `email:${email}`
    });

    return NextResponse.json({
      address: wallet.address,
      email,
      network: process.env.X402_NETWORK || 'base-sepolia'
    });

  } catch (error: any) {
    console.error('Wallet initialization error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to create account' },
      { status: 500 }
    );
  }
}

