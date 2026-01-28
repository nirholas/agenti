/**
 * Stripe Webhook Handler
 * @description Process Stripe subscription events
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

// TODO: Import from src/hosting when path aliases are configured
// For now, inline the subscription update logic

interface SubscriptionUpdate {
  userId: string;
  tier: 'free' | 'pro' | 'business' | 'enterprise';
  active: boolean;
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
}

// In-memory store for demo (replace with database)
const subscriptionUpdates: SubscriptionUpdate[] = [];

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log('Received Stripe webhook:', event.type);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const tier = session.metadata?.tier as 'pro' | 'business' | 'enterprise';

        if (userId && tier) {
          // Update user subscription
          subscriptionUpdates.push({
            userId,
            tier,
            active: true,
            stripeCustomerId: session.customer as string,
          });
          
          console.log('Subscription activated:', { userId, tier });
          
          // TODO: Update database
          // await prisma.user.update({
          //   where: { id: userId },
          //   data: { tier, stripeCustomerId: session.customer }
          // });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        const tier = subscription.metadata?.tier as 'pro' | 'business' | 'enterprise';

        if (userId) {
          const isActive = subscription.status === 'active';
          
          subscriptionUpdates.push({
            userId,
            tier: isActive ? (tier || 'pro') : 'free',
            active: isActive,
            stripeCustomerId: subscription.customer as string,
            stripeSubscriptionId: subscription.id,
          });

          console.log('Subscription updated:', { 
            userId, 
            tier,
            status: subscription.status,
            active: isActive,
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;

        if (userId) {
          subscriptionUpdates.push({
            userId,
            tier: 'free',
            active: false,
            stripeCustomerId: subscription.customer as string,
          });

          console.log('Subscription cancelled:', { userId });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn('Payment failed:', {
          customerId: invoice.customer,
          invoiceId: invoice.id,
          amountDue: invoice.amount_due,
        });
        // TODO: Send notification email to user
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment succeeded:', {
          customerId: invoice.customer,
          invoiceId: invoice.id,
          amountPaid: invoice.amount_paid,
        });
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// Disable body parsing - Stripe needs raw body
export const config = {
  api: {
    bodyParser: false,
  },
};
