/**
 * CrossFund Webhook Handler
 * Handles payment confirmation and failure events from CrossFund
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const WEBHOOK_SECRET = process.env.CROSSFUND_WEBHOOK_SECRET || '';

/**
 * Webhook event types
 */
export type WebhookEventType =
  | 'payment.confirmed'
  | 'payment.failed'
  | 'payment.pending'
  | 'payment.expired'
  | 'invoice.created'
  | 'invoice.cancelled'
  | 'refund.initiated'
  | 'refund.completed';

/**
 * Webhook payload structure
 */
export interface WebhookPayload {
  eventId: string;
  eventType: WebhookEventType;
  timestamp: number;
  data: {
    invoiceId: string;
    merchantId: string;
    amount: string;
    currency: string;
    paidAmount?: string;
    paidCurrency?: string;
    paidChainId?: number;
    transactionHash?: string;
    payerAddress?: string;
    status: string;
    metadata?: Record<string, any>;
    error?: string;
    errorCode?: string;
  };
}

/**
 * Processed events store for idempotency
 * In production, use Redis or a database
 */
const processedEvents = new Set<string>();

/**
 * Verify webhook signature using HMAC SHA-256
 */
function verifySignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.error('Webhook secret not configured');
    return false;
  }

  const expectedSig = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSig, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Check if event has already been processed (idempotency)
 */
function isEventProcessed(eventId: string): boolean {
  return processedEvents.has(eventId);
}

/**
 * Mark event as processed
 */
function markEventProcessed(eventId: string): void {
  processedEvents.add(eventId);
  
  // Clean up old events periodically (keep last 10000)
  if (processedEvents.size > 10000) {
    const eventsArray = Array.from(processedEvents);
    processedEvents.clear();
    eventsArray.slice(-5000).forEach(id => processedEvents.add(id));
  }
}

/**
 * Handle payment confirmed event
 */
async function handlePaymentConfirmed(data: WebhookPayload['data']): Promise<void> {
  console.log('Payment confirmed:', {
    invoiceId: data.invoiceId,
    amount: data.paidAmount,
    currency: data.paidCurrency,
    txHash: data.transactionHash,
  });

  // TODO: Implement your business logic here
  // - Update order status in database
  // - Send confirmation email to customer
  // - Trigger fulfillment process
  // - Update inventory
  // - Notify merchant

  // Example: Update order in database
  // await db.orders.update({
  //   where: { invoiceId: data.invoiceId },
  //   data: { 
  //     status: 'paid',
  //     paidAt: new Date(),
  //     transactionHash: data.transactionHash,
  //   }
  // });
}

/**
 * Handle payment failed event
 */
async function handlePaymentFailed(data: WebhookPayload['data']): Promise<void> {
  console.log('Payment failed:', {
    invoiceId: data.invoiceId,
    error: data.error,
    errorCode: data.errorCode,
  });

  // TODO: Implement your business logic here
  // - Update order status
  // - Notify customer of failure
  // - Log failure for analysis
  // - Potentially retry or offer alternative payment methods
}

/**
 * Handle payment pending event
 */
async function handlePaymentPending(data: WebhookPayload['data']): Promise<void> {
  console.log('Payment pending:', {
    invoiceId: data.invoiceId,
    txHash: data.transactionHash,
  });

  // Transaction submitted but not yet confirmed
  // - Update status to "processing"
  // - Show user a waiting message
}

/**
 * Handle payment expired event
 */
async function handlePaymentExpired(data: WebhookPayload['data']): Promise<void> {
  console.log('Payment expired:', {
    invoiceId: data.invoiceId,
  });

  // Invoice has expired without payment
  // - Update order status
  // - Release reserved inventory
  // - Notify customer
}

/**
 * Handle invoice created event
 */
async function handleInvoiceCreated(data: WebhookPayload['data']): Promise<void> {
  console.log('Invoice created:', {
    invoiceId: data.invoiceId,
    amount: data.amount,
    currency: data.currency,
  });
}

/**
 * Handle invoice cancelled event
 */
async function handleInvoiceCancelled(data: WebhookPayload['data']): Promise<void> {
  console.log('Invoice cancelled:', {
    invoiceId: data.invoiceId,
  });

  // - Update order status
  // - Release reserved inventory
}

/**
 * Handle refund initiated event
 */
async function handleRefundInitiated(data: WebhookPayload['data']): Promise<void> {
  console.log('Refund initiated:', {
    invoiceId: data.invoiceId,
    amount: data.amount,
  });

  // - Update order status to "refunding"
  // - Notify customer
}

/**
 * Handle refund completed event
 */
async function handleRefundCompleted(data: WebhookPayload['data']): Promise<void> {
  console.log('Refund completed:', {
    invoiceId: data.invoiceId,
    txHash: data.transactionHash,
  });

  // - Update order status to "refunded"
  // - Send refund confirmation to customer
}

/**
 * Route webhook event to appropriate handler
 */
async function routeWebhookEvent(payload: WebhookPayload): Promise<void> {
  const { eventType, data } = payload;

  switch (eventType) {
    case 'payment.confirmed':
      await handlePaymentConfirmed(data);
      break;
    case 'payment.failed':
      await handlePaymentFailed(data);
      break;
    case 'payment.pending':
      await handlePaymentPending(data);
      break;
    case 'payment.expired':
      await handlePaymentExpired(data);
      break;
    case 'invoice.created':
      await handleInvoiceCreated(data);
      break;
    case 'invoice.cancelled':
      await handleInvoiceCancelled(data);
      break;
    case 'refund.initiated':
      await handleRefundInitiated(data);
      break;
    case 'refund.completed':
      await handleRefundCompleted(data);
      break;
    default:
      console.warn('Unknown webhook event type:', eventType);
  }
}

/**
 * POST /api/webhooks/crossfund
 * Handle incoming webhooks from CrossFund
 */
export async function POST(request: NextRequest) {
  try {
    // Get signature from header
    const signature = request.headers.get('x-crossfund-signature');
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 401 }
      );
    }

    // Get raw body for signature verification
    const rawBody = await request.text();
    
    // Verify signature
    if (!verifySignature(rawBody, signature)) {
      console.error('Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse payload
    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Validate payload structure
    if (!payload.eventId || !payload.eventType || !payload.data) {
      return NextResponse.json(
        { error: 'Invalid payload structure' },
        { status: 400 }
      );
    }

    // Check idempotency
    if (isEventProcessed(payload.eventId)) {
      console.log('Event already processed:', payload.eventId);
      return NextResponse.json({ 
        success: true, 
        message: 'Event already processed' 
      });
    }

    // Process the webhook event
    await routeWebhookEvent(payload);

    // Mark as processed
    markEventProcessed(payload.eventId);

    return NextResponse.json({ 
      success: true,
      eventId: payload.eventId,
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    
    // Return 500 to trigger retry from CrossFund
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/crossfund
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    webhook: 'crossfund',
    timestamp: new Date().toISOString(),
  });
}
