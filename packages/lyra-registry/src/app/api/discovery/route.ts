import { NextRequest, NextResponse } from 'next/server';
import { getDb, schema } from '@/db';
import { eq, desc } from 'drizzle-orm';
import { submitDiscoverySchema, type ApiResponse } from '@/lib/validation';
import type { DiscoveryQueueItem } from '@/db/schema';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/discovery - List pending discovery items
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    
    const db = getDb();

    const items = await db
      .select()
      .from(schema.discoveryQueue)
      .where(eq(schema.discoveryQueue.status, status))
      .orderBy(desc(schema.discoveryQueue.createdAt))
      .limit(50);

    return NextResponse.json<ApiResponse<DiscoveryQueueItem[]>>({
      success: true,
      data: items,
    });

  } catch (error) {
    console.error('Error fetching discovery queue:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * POST /api/discovery - Submit a tool for review
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const result = submitDiscoverySchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Validation error',
        message: result.error.message,
      }, { status: 400 });
    }

    const db = getDb();
    const submissionData = result.data;

    // Check if already in queue
    const existing = await db
      .select({ id: schema.discoveryQueue.id })
      .from(schema.discoveryQueue)
      .where(eq(schema.discoveryQueue.sourceUrl, submissionData.sourceUrl))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Already in queue',
        message: 'This source URL is already in the discovery queue',
      }, { status: 409 });
    }

    const [newItem] = await db
      .insert(schema.discoveryQueue)
      .values(submissionData)
      .returning();

    return NextResponse.json<ApiResponse<DiscoveryQueueItem>>({
      success: true,
      data: newItem,
      message: 'Tool submitted for review',
    }, { status: 201 });

  } catch (error) {
    console.error('Error submitting to discovery:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
