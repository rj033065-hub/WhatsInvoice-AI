import { NextRequest, NextResponse } from 'next/server';
import { extractInvoiceFromMessage } from '@/lib/ai/extractor';
import { calculateInvoiceTotals } from '@/lib/calculations';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rawMessage, customApiKey } = body;

    if (!rawMessage || typeof rawMessage !== 'string' || !rawMessage.trim()) {
      return NextResponse.json(
        { error: 'Invalid or missing rawMessage' },
        { status: 400 }
      );
    }

    // 1. Extract raw details using AI / extractor
    const rawExtracted = await extractInvoiceFromMessage(rawMessage, customApiKey);

    // 2. CRITICAL RULE: Server-side exact arithmetic with Decimal.js
    const financialTotals = calculateInvoiceTotals({
      items: rawExtracted.items,
      gst_rate: rawExtracted.gst_rate,
      discount: rawExtracted.discount,
    });

    return NextResponse.json({
      success: true,
      extractedData: {
        customer_name: rawExtracted.customer_name,
        customer_phone: rawExtracted.customer_phone,
        customer_email: rawExtracted.customer_email,
        customer_address: rawExtracted.customer_address,
        currency: rawExtracted.currency,
        gst_rate: financialTotals.gst_rate,
        gst_amount: financialTotals.gst_amount,
        discount: financialTotals.discount,
        total: financialTotals.total,
        subtotal: financialTotals.subtotal,
        items: financialTotals.items,
        notes: rawExtracted.notes,
        issues: rawExtracted.issues,
      },
    });
  } catch (error: any) {
    console.error('Extraction API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to extract invoice data' },
      { status: 500 }
    );
  }
}
