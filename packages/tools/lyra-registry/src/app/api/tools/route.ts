import { NextRequest, NextResponse } from 'next/server';
import { getDb, schema } from '@/db';
import { eq, sql, desc, asc, like, and, or } from 'drizzle-orm';
import { createToolSchema, searchQuerySchema, type ApiResponse, type PaginatedResponse } from '@/lib/validation';
import { calculateToolScore } from '@/lib/calculateScore';
import type { Tool } from '@/db/schema';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/tools - List and search tools
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
    
    // Build conditions array
    const conditions = [];

    // Text search
    if (q) {
      conditions.push(
        or(
          like(schema.tools.name, `%${q}%`),
          like(schema.tools.description, `%${q}%`)
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

    // Chain filter (array contains)
    if (chain) {
      conditions.push(sql`${chain} = ANY(${schema.tools.chains})`);
    }

    // Protocol filter (array contains)
    if (protocol) {
      conditions.push(sql`${protocol} = ANY(${schema.tools.protocols})`);
    }

    // Tags filter (comma-separated)
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim());
      for (const tag of tagList) {
        conditions.push(sql`${tag} = ANY(${schema.tools.tags})`);
      }
    }

    // Build query
    const offset = (page - 1) * limit;
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

    // Get paginated results
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
    console.error('Error fetching tools:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * POST /api/tools - Create a new tool
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    const result = createToolSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Validation error',
        message: result.error.message,
      }, { status: 400 });
    }

    const toolData = result.data;
    const db = getDb();

    // Check if tool already exists
    const existing = await db
      .select({ id: schema.tools.id })
      .from(schema.tools)
      .where(eq(schema.tools.name, toolData.name))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Tool already exists',
        message: `A tool with name "${toolData.name}" already exists`,
      }, { status: 409 });
    }

    // Calculate score
    const scoreResult = calculateToolScore({
      isValidated: toolData.isValidated,
      hasTools: toolData.hasTools,
      hasDeployment: toolData.hasDeployment,
      hasDeployMoreThanManual: toolData.hasDeployMoreThanManual,
      hasReadme: toolData.hasReadme,
      hasLicense: toolData.hasLicense,
      hasPrompts: toolData.hasPrompts,
      hasResources: toolData.hasResources,
      isClaimed: toolData.isClaimed,
    });

    // Insert tool
    const [newTool] = await db
      .insert(schema.tools)
      .values({
        ...toolData,
        totalScore: scoreResult.totalScore,
        maxScore: scoreResult.maxScore,
        percentage: scoreResult.percentage,
        grade: scoreResult.grade,
        scoreData: {
          hasValidated: toolData.isValidated || false,
          hasTools: toolData.hasTools || true,
          hasDeployment: toolData.hasDeployment || false,
          hasDeployMoreThanManual: toolData.hasDeployMoreThanManual || false,
          hasReadme: toolData.hasReadme || false,
          hasLicense: toolData.hasLicense || false,
          hasPrompts: toolData.hasPrompts || false,
          hasResources: toolData.hasResources || false,
          hasClaimed: toolData.isClaimed || false,
        },
      })
      .returning();

    // Update category tool count if exists
    await db
      .update(schema.categories)
      .set({
        toolCount: sql`${schema.categories.toolCount} + 1`,
      })
      .where(eq(schema.categories.slug, toolData.category));

    return NextResponse.json<ApiResponse<Tool>>({
      success: true,
      data: newTool,
      message: 'Tool created successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating tool:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
