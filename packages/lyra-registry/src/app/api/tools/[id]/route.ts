import { NextRequest, NextResponse } from 'next/server';
import { getDb, schema } from '@/db';
import { eq, sql } from 'drizzle-orm';
import { updateToolSchema, type ApiResponse } from '@/lib/validation';
import { calculateToolScore } from '@/lib/calculateScore';
import type { Tool } from '@/db/schema';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tools/[id] - Get a single tool by ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const db = getDb();

    const [tool] = await db
      .select()
      .from(schema.tools)
      .where(eq(schema.tools.id, id))
      .limit(1);

    if (!tool) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Tool not found',
        message: `No tool found with ID: ${id}`,
      }, { status: 404 });
    }

    // Log view for trending
    await db.insert(schema.toolUsageLogs).values({
      toolId: id,
      action: 'view',
    });

    return NextResponse.json<ApiResponse<Tool>>({
      success: true,
      data: tool,
    });

  } catch (error) {
    console.error('Error fetching tool:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * PATCH /api/tools/[id] - Update a tool
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const result = updateToolSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Validation error',
        message: result.error.message,
      }, { status: 400 });
    }

    const db = getDb();
    const updateData = result.data;

    // Check if tool exists
    const [existing] = await db
      .select()
      .from(schema.tools)
      .where(eq(schema.tools.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Tool not found',
        message: `No tool found with ID: ${id}`,
      }, { status: 404 });
    }

    // Recalculate score if any scoring-related fields changed
    const scoringFields = [
      'isValidated', 'hasTools', 'hasDeployment', 'hasDeployMoreThanManual',
      'hasReadme', 'hasLicense', 'hasPrompts', 'hasResources', 'isClaimed'
    ];
    
    const needsScoreRecalc = scoringFields.some(field => field in updateData);
    
    let scoreUpdate = {};
    if (needsScoreRecalc) {
      const merged = {
        isValidated: updateData.isValidated ?? existing.isValidated,
        hasTools: updateData.hasTools ?? existing.hasTools,
        hasDeployment: updateData.hasDeployment ?? existing.hasDeployment,
        hasDeployMoreThanManual: updateData.hasDeployMoreThanManual ?? existing.hasDeployMoreThanManual,
        hasReadme: updateData.hasReadme ?? existing.hasReadme,
        hasLicense: updateData.hasLicense ?? existing.hasLicense,
        hasPrompts: updateData.hasPrompts ?? existing.hasPrompts,
        hasResources: updateData.hasResources ?? existing.hasResources,
        isClaimed: updateData.isClaimed ?? existing.isClaimed,
      };
      
      const scoreResult = calculateToolScore(merged);
      scoreUpdate = {
        totalScore: scoreResult.totalScore,
        maxScore: scoreResult.maxScore,
        percentage: scoreResult.percentage,
        grade: scoreResult.grade,
        scoreData: {
          hasValidated: merged.isValidated,
          hasTools: merged.hasTools,
          hasDeployment: merged.hasDeployment,
          hasDeployMoreThanManual: merged.hasDeployMoreThanManual,
          hasReadme: merged.hasReadme,
          hasLicense: merged.hasLicense,
          hasPrompts: merged.hasPrompts,
          hasResources: merged.hasResources,
          hasClaimed: merged.isClaimed,
        },
      };
    }

    // Update tool
    const [updatedTool] = await db
      .update(schema.tools)
      .set({
        ...updateData,
        ...scoreUpdate,
        updatedAt: new Date(),
      })
      .where(eq(schema.tools.id, id))
      .returning();

    return NextResponse.json<ApiResponse<Tool>>({
      success: true,
      data: updatedTool,
      message: 'Tool updated successfully',
    });

  } catch (error) {
    console.error('Error updating tool:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * DELETE /api/tools/[id] - Delete a tool
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const db = getDb();

    // Check if tool exists
    const [existing] = await db
      .select({ id: schema.tools.id, category: schema.tools.category })
      .from(schema.tools)
      .where(eq(schema.tools.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Tool not found',
        message: `No tool found with ID: ${id}`,
      }, { status: 404 });
    }

    // Delete tool (usage logs will cascade)
    await db
      .delete(schema.tools)
      .where(eq(schema.tools.id, id));

    // Update category tool count
    await db
      .update(schema.categories)
      .set({
        toolCount: sql`GREATEST(${schema.categories.toolCount} - 1, 0)`,
      })
      .where(eq(schema.categories.slug, existing.category));

    return NextResponse.json<ApiResponse<{ id: string }>>({
      success: true,
      data: { id },
      message: 'Tool deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting tool:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
