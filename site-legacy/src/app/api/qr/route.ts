import { NextRequest, NextResponse } from 'next/server';
import { generateQRCodeSVG, createPaymentQRData, type PaymentQRData } from '@/lib/qr/generator';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      recipient,
      amount,
      chainId = 1,
      tokenAddress,
      memo,
      width = 300,
      margin = 2,
      darkColor = '#000000',
      lightColor = '#FFFFFF',
    } = body;

    if (!recipient) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Recipient address is required',
        },
      }, { status: 400 });
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid recipient address format',
        },
      }, { status: 400 });
    }

    const qrData: PaymentQRData = createPaymentQRData(recipient, {
      amount,
      chainId,
      tokenAddress,
      memo,
    });

    const result = await generateQRCodeSVG(qrData, {
      width,
      margin,
      color: { dark: darkColor, light: lightColor },
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'QR_GENERATION_ERROR',
          message: result.error || 'Failed to generate QR code',
        },
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      svg: result.svg,
      dataUrl: result.dataUrl,
      paymentData: qrData,
    });
  } catch (error) {
    console.error('QR API error:', error);

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const recipient = searchParams.get('to');
  const amount = searchParams.get('amount');
  const chainId = parseInt(searchParams.get('chainId') || '1');
  const tokenAddress = searchParams.get('token');
  const memo = searchParams.get('memo');
  const format = searchParams.get('format') || 'json'; // json, svg, or image

  if (!recipient) {
    return NextResponse.json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Recipient address is required (use ?to=0x...)',
      },
    }, { status: 400 });
  }

  try {
    const qrData: PaymentQRData = createPaymentQRData(recipient, {
      amount: amount || undefined,
      chainId,
      tokenAddress: tokenAddress || undefined,
      memo: memo || undefined,
    });

    const result = await generateQRCodeSVG(qrData, {
      width: 300,
      margin: 2,
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: { code: 'QR_ERROR', message: result.error },
      }, { status: 500 });
    }

    // Return based on format
    if (format === 'svg') {
      return new NextResponse(result.svg, {
        headers: { 'Content-Type': 'image/svg+xml' },
      });
    }

    if (format === 'image') {
      // Return base64 data URL as image
      const base64Data = result.dataUrl?.split(',')[1];
      if (base64Data) {
        const buffer = Buffer.from(base64Data, 'base64');
        return new NextResponse(buffer, {
          headers: { 'Content-Type': 'image/png' },
        });
      }
    }

    return NextResponse.json({
      success: true,
      svg: result.svg,
      dataUrl: result.dataUrl,
      paymentData: qrData,
    });
  } catch (error) {
    console.error('QR API error:', error);

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    }, { status: 500 });
  }
}
