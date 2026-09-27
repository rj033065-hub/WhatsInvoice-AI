import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateInvoiceTotals, validateCalculationInput } from '@/lib/calculations';

/**
 * GET /api/invoices
 * Lists all invoices owned by the authenticated user.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to access invoices.' },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Invoices fetch error:', error.message);
      return NextResponse.json(
        { error: 'Failed to retrieve invoices.' },
        { status: 500 }
      );
    }

    const formatted = (data || []).map((inv: any) => ({
      ...inv,
      items: inv.invoice_items || [],
      extraction_issues: inv.extraction_issues || [],
    }));

    return NextResponse.json({ success: true, invoices: formatted });
  } catch (err: any) {
    console.error('Invoices GET handler error:', err);
    return NextResponse.json(
      { error: 'Internal server error while fetching invoices.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/invoices
 * Creates a new invoice with its line items for the authenticated user.
 * Recalculates all financial values server-side.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to create invoices.' },
        { status: 401 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload in request body.' },
        { status: 400 }
      );
    }

    const {
      customer_name,
      customer_phone,
      customer_email,
      customer_address,
      status = 'draft',
      source_message,
      items = [],
      gst_rate = 0,
      discount = 0,
      discount_type = 'percentage',
      business_id,
      extraction_issues = [],
    } = body;

    // Validate customer name
    if (!customer_name || typeof customer_name !== 'string' || !customer_name.trim()) {
      return NextResponse.json(
        { error: 'Customer name is required and cannot be empty.' },
        { status: 400 }
      );
    }

    // Validate items array
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'At least one line item is required to create an invoice.' },
        { status: 400 }
      );
    }

    // Validate calculations input
    const validation = validateCalculationInput({
      items,
      gst_rate,
      discount,
    });

    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Calculation validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    // ── CRITICAL: Server-side financial recalculation with Decimal.js ──────────
    const calculated = calculateInvoiceTotals({
      items,
      gst_rate,
      discount,
      discount_type,
    });

    // Generate unique invoice number if not explicitly provided
    let invoice_number = body.invoice_number;
    if (!invoice_number || typeof invoice_number !== 'string' || !invoice_number.trim()) {
      const now = new Date();
      const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
      const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
      invoice_number = `INV-${datePart}-${randPart}`;
    } else {
      invoice_number = invoice_number.trim();
    }

    // Prepare invoice row
    const invoicePayload = {
      user_id: user.id,
      business_id: business_id || null,
      invoice_number,
      customer_name: customer_name.trim(),
      customer_phone: customer_phone ? String(customer_phone).trim() : null,
      customer_email: customer_email ? String(customer_email).trim() : null,
      customer_address: customer_address ? String(customer_address).trim() : null,
      subtotal: calculated.subtotal,
      discount: calculated.discount,
      gst_rate: calculated.gst_rate,
      gst_amount: calculated.gst_amount,
      total: calculated.total,
      status: ['draft', 'pending', 'paid', 'overdue', 'cancelled'].includes(status)
        ? status
        : 'draft',
      source_message: source_message || null,
    };

    const { data: insertedInvoice, error: invError } = await supabase
      .from('invoices')
      .insert([invoicePayload])
      .select()
      .single();

    if (invError) {
      console.error('Supabase invoice insert error:', invError.message);
      return NextResponse.json(
        { error: invError.message || 'Failed to create invoice record.' },
        { status: 400 }
      );
    }

    // Insert line items
    const lineItemsToInsert = calculated.items.map((item) => ({
      invoice_id: insertedInvoice.id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from('invoice_items')
      .insert(lineItemsToInsert)
      .select();

    if (itemsError) {
      console.error('Invoice items insert error:', itemsError.message);
    }

    return NextResponse.json(
      {
        success: true,
        invoice: {
          ...insertedInvoice,
          items: insertedItems || calculated.items,
          extraction_issues,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Invoices POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error while creating invoice.' },
      { status: 500 }
    );
  }
}
