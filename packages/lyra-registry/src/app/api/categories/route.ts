import { NextRequest, NextResponse } from 'next/server';
import { getDb, schema } from '@/db';
import { eq, desc } from 'drizzle-orm';
import { createCategorySchema, type ApiResponse } from '@/lib/validation';
import type { Category } from '@/db/schema';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

/**
 * GET /api/categories - List all categories with tool counts
 */
export async function GET() {
  try {
    const db = getDb();

    const categories = await db
      .select()
      .from(schema.categories)
      .orderBy(desc(schema.categories.toolCount));

    return NextResponse.json<ApiResponse<Category[]>>({
      success: true,
      data: categories,
    });

  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * POST /api/categories - Create a new category
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const result = createCategorySchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Validation error',
        message: result.error.message,
      }, { status: 400 });
    }

    const db = getDb();
    const categoryData = result.data;

    // Check if category exists
    const existing = await db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(eq(schema.categories.slug, categoryData.slug))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Category already exists',
        message: `A category with slug "${categoryData.slug}" already exists`,
      }, { status: 409 });
    }

    const [newCategory] = await db
      .insert(schema.categories)
      .values(categoryData)
      .returning();

    return NextResponse.json<ApiResponse<Category>>({
      success: true,
      data: newCategory,
      message: 'Category created successfully',
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json<ApiResponse<null>>({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
