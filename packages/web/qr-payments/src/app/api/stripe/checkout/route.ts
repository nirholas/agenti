/**
 * Stripe Checkout Session API
 * @description Create checkout sessions for subscription upgrades
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

// Price IDs from Stripe Dashboard
// TODO: Create these products in Stripe and update the IDs
const PRICE_IDS = {
  pro: process.env.STRIPE_PRICE_PRO || 'price_1234_pro',
  business: process.env.STRIPE_PRICE_BUSINESS || 'price_1234_business',
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE || 'price_1234_enterprise',
} as const;

type Tier = keyof typeof PRICE_IDS;

interface CheckoutRequest {
  tier: Tier;
  userId: string;
  email: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CheckoutRequest;
    const { tier, userId, email } = body;

    // Validate tier
    if (!tier || !PRICE_IDS[tier]) {
      return NextResponse.json(
        { error: 'Invalid subscription tier' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!userId || !email) {
      return NextResponse.json(
        { error: 'Missing userId or email' },
        { status: 400 }
      );
    }

    // Get base URL for redirects
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price: PRICE_IDS[tier],
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/dashboard?upgrade=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard/billing?upgrade=cancelled`,
      metadata: {
        userId,
        tier,
      },
      subscription_data: {
        metadata: {
          userId,
          tier,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

    console.log('Checkout session created:', {
      sessionId: session.id,
      userId,
      tier,
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Checkout session error:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

/**
 * Get checkout session status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session_id parameter' },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });

    return NextResponse.json({
      status: session.status,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_email,
      subscription: session.subscription ? {
        id: (session.subscription as Stripe.Subscription).id,
        status: (session.subscription as Stripe.Subscription).status,
      } : null,
    });
  } catch (error) {
    console.error('Get session error:', error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to retrieve session' },
      { status: 500 }
    );
  }
}
