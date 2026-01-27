import { NextRequest, NextResponse } from 'next/server';
import { getDb, schema } from '@/db';
import { sql, desc, asc, or, and, eq } from 'drizzle-orm';
import { searchQuerySchema, type ApiResponse, type PaginatedResponse } from '@/lib/validation';
import type { Tool } from '@/db/schema';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/search - Full-text search for tools
 * 
 * Supports:
 * - Text search in name, description
 * - Filters: category, chain, protocol, grade, tags
 * - Sorting and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse and validate query params
    const queryResult = searchQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!queryResult.success) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Invalid query parameters',
        message: queryResult.error.message,
      }, { status: 400 });
    }

    const { q, category, chain, protocol, grade, requiresApiKey, tags, page, limit, sortBy, sortOrder } = queryResult.data;
    const db = getDb();

    // Build conditions
    const conditions = [];

    // Text search (required for search endpoint)
    if (q && q.length > 0) {
      const searchTerm = `%${q.toLowerCase()}%`;
      conditions.push(
        or(
          sql`LOWER(${schema.tools.name}) LIKE ${searchTerm}`,
          sql`LOWER(${schema.tools.description}) LIKE ${searchTerm}`
        )
      );
    }

    // Category filter
    if (category) {
      conditions.push(eq(schema.tools.category, category));
    }

    // Grade filter
    if (grade) {
      conditions.push(eq(schema.tools.grade, grade));
    }

    // API key filter
    if (requiresApiKey !== undefined) {
      conditions.push(eq(schema.tools.requiresApiKey, requiresApiKey === 'true'));
    }

    // Chain filter
    if (chain) {
      conditions.push(sql`${chain} = ANY(${schema.tools.chains})`);
    }

    // Protocol filter
    if (protocol) {
      conditions.push(sql`${protocol} = ANY(${schema.tools.protocols})`);
    }

    // Tags filter
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim().toLowerCase());
      for (const tag of tagList) {
        conditions.push(sql`${tag} = ANY(${schema.tools.tags})`);
      }
    }

    // Pagination
    const offset = (page - 1) * limit;

    // Sorting
    const orderColumn = {
      name: schema.tools.name,
      createdAt: schema.tools.createdAt,
      updatedAt: schema.tools.updatedAt,
      totalScore: schema.tools.totalScore,
      downloadCount: schema.tools.downloadCount,
    }[sortBy] || schema.tools.totalScore;

    const orderFn = sortOrder === 'asc' ? asc : desc;

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.tools)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(countResult[0]?.count || 0);

    // Get results
    const items = await db
      .select()
      .from(schema.tools)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderFn(orderColumn))
      .limit(limit)
      .offset(offset);

    const response: PaginatedResponse<Tool> = {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    return NextResponse.json<ApiResponse<PaginatedResponse<Tool>>>({
      success: true,
      data: response,
    });

  } catch (error) {
    console.error('Error searching tools:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
