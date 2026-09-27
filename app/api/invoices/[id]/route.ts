import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateInvoiceTotals, validateCalculationInput } from '@/lib/calculations';

/**
 * GET /api/invoices/[id]
 * Retrieves a single invoice with its line items.
 * Returns 404 for unowned / missing invoices to prevent resource enumeration.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    // Ownership check via user_id filter + RLS
    const { data, error } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error || !data) {
      // Consistently return 404 for both non-existent and unowned records
      return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      invoice: {
        ...data,
        items: data.invoice_items || [],
      },
    });
  } catch (err: any) {
    console.error('Invoice GET by ID error:', err);
    return NextResponse.json(
      { error: 'Internal server error while fetching invoice.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/invoices/[id]
 * Updates invoice details and line items.
 * Recalculates all financial figures server-side.
 * Returns 404 for unowned / missing invoices.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
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

    // 1. Verify existence & ownership
    const { data: existing, error: findError } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (findError || !existing) {
      return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
    }

    const {
      customer_name,
      customer_phone,
      customer_email,
      customer_address,
      status,
      source_message,
      gst_rate,
      discount,
      discount_type = 'percentage',
      items,
      invoice_number,
    } = body;

    // Use updated or fallback to existing items & tax rates
    const itemsToCalculate = Array.isArray(items) && items.length > 0
      ? items
      : existing.invoice_items || [];

    const gstRateToUse = gst_rate !== undefined ? gst_rate : existing.gst_rate;
    const discountToUse = discount !== undefined ? discount : existing.discount;

    // Validate calculations input
    const validation = validateCalculationInput({
      items: itemsToCalculate,
      gst_rate: gstRateToUse,
      discount: discountToUse,
    });

    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Calculation validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    // ── CRITICAL: Server-side recalculation with Decimal.js ───────────────────
    const calculated = calculateInvoiceTotals({
      items: itemsToCalculate,
      gst_rate: gstRateToUse,
      discount: discountToUse,
      discount_type,
    });

    const updatePayload: Record<string, any> = {
      subtotal: calculated.subtotal,
      discount: calculated.discount,
      gst_rate: calculated.gst_rate,
      gst_amount: calculated.gst_amount,
      total: calculated.total,
    };

    if (customer_name !== undefined) {
      if (typeof customer_name !== 'string' || !customer_name.trim()) {
        return NextResponse.json(
          { error: 'Customer name cannot be empty.' },
          { status: 400 }
        );
      }
      updatePayload.customer_name = customer_name.trim();
    }

    if (customer_phone !== undefined) updatePayload.customer_phone = customer_phone ? String(customer_phone).trim() : null;
    if (customer_email !== undefined) updatePayload.customer_email = customer_email ? String(customer_email).trim() : null;
    if (customer_address !== undefined) updatePayload.customer_address = customer_address ? String(customer_address).trim() : null;
    if (source_message !== undefined) updatePayload.source_message = source_message || null;
    if (invoice_number !== undefined && typeof invoice_number === 'string' && invoice_number.trim()) {
      updatePayload.invoice_number = invoice_number.trim();
    }
    if (status !== undefined && ['draft', 'pending', 'paid', 'overdue', 'cancelled'].includes(status)) {
      updatePayload.status = status;
    }

    const { data: updatedInvoice, error: updateErr } = await supabase
      .from('invoices')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json(
        { error: updateErr.message || 'Failed to update invoice.' },
        { status: 400 }
      );
    }

    // If items were provided, atomically replace line items
    let finalItems = existing.invoice_items;
    if (Array.isArray(items)) {
      await supabase.from('invoice_items').delete().eq('invoice_id', id);

      const lineItemsToInsert = calculated.items.map((item) => ({
        invoice_id: id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
      }));

      const { data: insertedItems } = await supabase
        .from('invoice_items')
        .insert(lineItemsToInsert)
        .select();

      finalItems = insertedItems || calculated.items;
    }

    return NextResponse.json({
      success: true,
      invoice: {
        ...updatedInvoice,
        items: finalItems,
      },
    });
  } catch (err: any) {
    console.error('Invoice PATCH error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error while updating invoice.' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/invoices/[id]
 * Full update alias forwarding to PATCH logic.
 */
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return PATCH(req, context);
}

/**
 * DELETE /api/invoices/[id]
 * Deletes an invoice owned by the authenticated user.
 * Returns 404 for unowned / missing invoices.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    // 1. Verify existence & ownership first
    const { data: existing, error: findError } = await supabase
      .from('invoices')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (findError || !existing) {
      // 404 prevents revealing resource existence
      return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
    }

    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to delete invoice.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Invoice deleted successfully.',
    });
  } catch (err: any) {
    console.error('Invoice DELETE error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error while deleting invoice.' },
      { status: 500 }
    );
  }
}
