/**
 * GET /api/merchant/invoices
 * List all invoices for the merchant
 */

import { NextRequest, NextResponse } from 'next/server';
import { listInvoices, Invoice } from '@/lib/merchant/invoice';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const status = searchParams.get('status') as Invoice['status'] | null;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    // Validate pagination
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }

    // Parse dates
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    if (startDate && isNaN(startDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid startDate format' },
        { status: 400 }
      );
    }

    if (endDate && isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid endDate format' },
        { status: 400 }
      );
    }

    // Fetch invoices
    const result = await listInvoices({
      page,
      limit,
      status: status || undefined,
      startDate,
      endDate,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      invoices: result.invoices,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (error) {
    console.error('Error listing invoices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
