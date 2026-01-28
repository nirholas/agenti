/**
 * GET /api/merchant/invoices/[id]
 * Get single invoice details
 */

import { NextRequest, NextResponse } from 'next/server';
import { getInvoice, isInvoiceValid, getInvoiceTimeRemaining } from '../../../../../lib/merchant/invoice';
import { getPaymentStatus } from '@/lib/merchant/payment';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    // Fetch invoice details
    const invoiceResult = await getInvoice(id);

    if (!invoiceResult.success || !invoiceResult.invoice) {
      return NextResponse.json(
        { error: invoiceResult.error || 'Invoice not found' },
        { status: 404 }
      );
    }

    const invoice = invoiceResult.invoice;

    // Get additional payment status if invoice is pending
    let paymentStatus = null;
    if (invoice.status === 'pending') {
      const statusResult = await getPaymentStatus(id);
      if (statusResult.success) {
        paymentStatus = {
          transactionHash: statusResult.transactionHash,
          confirmations: statusResult.confirmations,
          paidAmount: statusResult.paidAmount,
          paidCurrency: statusResult.paidCurrency,
        };
      }
    }

    // Calculate additional metadata
    const isValid = isInvoiceValid(invoice);
    const timeRemaining = getInvoiceTimeRemaining(invoice);

    return NextResponse.json({
      success: true,
      invoice: {
        ...invoice,
        isValid,
        timeRemaining,
        paymentStatus,
      },
    });
  } catch (error) {
    console.error('Error getting invoice:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
