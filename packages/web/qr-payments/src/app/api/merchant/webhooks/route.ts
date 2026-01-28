/**
 * GET/POST /api/merchant/webhooks
 * Configure merchant webhooks
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const CROSSFUND_API_URL = process.env.CROSSFUND_API_URL || 'https://payments.crossfund.xyz';
const CROSSFUND_API_KEY = process.env.CROSSFUND_API_KEY || '';
const CROSSFUND_MERCHANT_ID = process.env.CROSSFUND_MERCHANT_ID || '';

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  enabled: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
  lastTriggeredAt?: string;
  lastStatus?: 'success' | 'failed';
  failureCount: number;
}

export type WebhookEvent =
  | 'payment.confirmed'
  | 'payment.failed'
  | 'payment.pending'
  | 'payment.expired'
  | 'invoice.created'
  | 'invoice.cancelled'
  | 'refund.initiated'
  | 'refund.completed'
  | '*'; // all events

export interface CreateWebhookRequest {
  url: string;
  events: WebhookEvent[];
  description?: string;
  enabled?: boolean;
}

export interface UpdateWebhookRequest {
  id: string;
  url?: string;
  events?: WebhookEvent[];
  description?: string;
  enabled?: boolean;
  regenerateSecret?: boolean;
}

export interface WebhookTestResult {
  success: boolean;
  statusCode?: number;
  responseTime?: number;
  error?: string;
}

/**
 * GET - List all webhook endpoints
 */
export async function GET() {
  try {
    const response = await fetch(
      `${CROSSFUND_API_URL}/api/v1/webhooks`,
      {
        headers: {
          'Authorization': `Bearer ${CROSSFUND_API_KEY}`,
          'X-Merchant-ID': CROSSFUND_MERCHANT_ID,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.message || 'Failed to fetch webhooks' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Mask secrets for security
    const webhooks = (data.webhooks || []).map((webhook: WebhookEndpoint) => ({
      ...webhook,
      secret: maskSecret(webhook.secret),
    }));

    return NextResponse.json({
      success: true,
      webhooks,
      availableEvents: [
        'payment.confirmed',
        'payment.failed',
        'payment.pending',
        'payment.expired',
        'invoice.created',
        'invoice.cancelled',
        'refund.initiated',
        'refund.completed',
        '*',
      ],
    });
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create, update, delete, or test webhook
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action || 'create';

    switch (action) {
      case 'create':
        return await createWebhook(body);
      case 'update':
        return await updateWebhook(body);
      case 'delete':
        return await deleteWebhook(body.id);
      case 'test':
        return await testWebhook(body.id);
      case 'rotate-secret':
        return await rotateSecret(body.id);
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error processing webhook request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Create a new webhook endpoint
 */
async function createWebhook(body: CreateWebhookRequest) {
  // Validate URL
  if (!body.url || !isValidUrl(body.url)) {
    return NextResponse.json(
      { error: 'Invalid webhook URL' },
      { status: 400 }
    );
  }

  // Validate events
  if (!body.events || body.events.length === 0) {
    return NextResponse.json(
      { error: 'At least one event type is required' },
      { status: 400 }
    );
  }

  // Generate a secure secret
  const secret = generateWebhookSecret();

  const response = await fetch(
    `${CROSSFUND_API_URL}/api/v1/webhooks`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CROSSFUND_API_KEY}`,
        'X-Merchant-ID': CROSSFUND_MERCHANT_ID,
      },
      body: JSON.stringify({
        url: body.url,
        events: body.events,
        description: body.description,
        enabled: body.enabled ?? true,
        secret,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return NextResponse.json(
      { error: errorData.message || 'Failed to create webhook' },
      { status: response.status }
    );
  }

  const data = await response.json();

  return NextResponse.json({
    success: true,
    webhook: data.webhook,
    // Return the secret once for the user to save
    secret: secret,
    message: 'Webhook created successfully. Save the secret - it will not be shown again.',
  });
}

/**
 * Update an existing webhook endpoint
 */
async function updateWebhook(body: UpdateWebhookRequest) {
  if (!body.id) {
    return NextResponse.json(
      { error: 'Webhook ID is required' },
      { status: 400 }
    );
  }

  // Validate URL if provided
  if (body.url && !isValidUrl(body.url)) {
    return NextResponse.json(
      { error: 'Invalid webhook URL' },
      { status: 400 }
    );
  }

  const updateData: Record<string, any> = {};
  if (body.url) updateData.url = body.url;
  if (body.events) updateData.events = body.events;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.enabled !== undefined) updateData.enabled = body.enabled;

  // Generate new secret if requested
  let newSecret: string | undefined;
  if (body.regenerateSecret) {
    newSecret = generateWebhookSecret();
    updateData.secret = newSecret;
  }

  const response = await fetch(
    `${CROSSFUND_API_URL}/api/v1/webhooks/${body.id}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CROSSFUND_API_KEY}`,
        'X-Merchant-ID': CROSSFUND_MERCHANT_ID,
      },
      body: JSON.stringify(updateData),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return NextResponse.json(
      { error: errorData.message || 'Failed to update webhook' },
      { status: response.status }
    );
  }

  const data = await response.json();

  const result: any = {
    success: true,
    webhook: data.webhook,
    message: 'Webhook updated successfully',
  };

  if (newSecret) {
    result.secret = newSecret;
    result.message += '. New secret generated - save it now.';
  }

  return NextResponse.json(result);
}

/**
 * Delete a webhook endpoint
 */
async function deleteWebhook(id: string) {
  if (!id) {
    return NextResponse.json(
      { error: 'Webhook ID is required' },
      { status: 400 }
    );
  }

  const response = await fetch(
    `${CROSSFUND_API_URL}/api/v1/webhooks/${id}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${CROSSFUND_API_KEY}`,
        'X-Merchant-ID': CROSSFUND_MERCHANT_ID,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return NextResponse.json(
      { error: errorData.message || 'Failed to delete webhook' },
      { status: response.status }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Webhook deleted successfully',
  });
}

/**
 * Test a webhook endpoint
 */
async function testWebhook(id: string): Promise<NextResponse> {
  if (!id) {
    return NextResponse.json(
      { error: 'Webhook ID is required' },
      { status: 400 }
    );
  }

  const response = await fetch(
    `${CROSSFUND_API_URL}/api/v1/webhooks/${id}/test`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CROSSFUND_API_KEY}`,
        'X-Merchant-ID': CROSSFUND_MERCHANT_ID,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return NextResponse.json(
      { error: errorData.message || 'Failed to test webhook' },
      { status: response.status }
    );
  }

  const data = await response.json();

  return NextResponse.json({
    success: true,
    testResult: data.result as WebhookTestResult,
  });
}

/**
 * Rotate webhook secret
 */
async function rotateSecret(id: string) {
  if (!id) {
    return NextResponse.json(
      { error: 'Webhook ID is required' },
      { status: 400 }
    );
  }

  const newSecret = generateWebhookSecret();

  const response = await fetch(
    `${CROSSFUND_API_URL}/api/v1/webhooks/${id}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CROSSFUND_API_KEY}`,
        'X-Merchant-ID': CROSSFUND_MERCHANT_ID,
      },
      body: JSON.stringify({ secret: newSecret }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return NextResponse.json(
      { error: errorData.message || 'Failed to rotate secret' },
      { status: response.status }
    );
  }

  return NextResponse.json({
    success: true,
    secret: newSecret,
    message: 'Webhook secret rotated successfully. Update your integration with the new secret.',
  });
}

/**
 * Generate a secure webhook secret
 */
function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Mask secret for display
 */
function maskSecret(secret: string): string {
  if (!secret || secret.length < 12) {
    return '********';
  }
  return `${secret.slice(0, 10)}...${secret.slice(-4)}`;
}

/**
 * Validate URL
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow https for security
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
