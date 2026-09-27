import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Validates business payload server-side.
 */
function validateBusinessPayload(body: any) {
  const errors: string[] = [];

  if (!body.business_name || typeof body.business_name !== 'string' || !body.business_name.trim()) {
    errors.push('Business name is required.');
  }

  if (body.email && typeof body.email === 'string') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email.trim())) {
      errors.push('Invalid email address format.');
    }
  }

  if (body.gstin && typeof body.gstin === 'string' && body.gstin.trim()) {
    // Standard Indian GSTIN format is 15 alphanumeric characters
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
    if (body.gstin.trim().length !== 15 && !gstinRegex.test(body.gstin.trim())) {
      // We can warn or permit loose format if valid length
      if (body.gstin.trim().length > 20) {
        errors.push('GSTIN exceeds maximum character length.');
      }
    }
  }

  if (body.pincode && typeof body.pincode === 'string' && body.pincode.trim()) {
    if (!/^\d{4,8}$/.test(body.pincode.trim())) {
      errors.push('Pincode should contain 4 to 8 digits.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * GET /api/business
 * Returns the business profile of the authenticated user.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Business fetch error:', error.message);
      return NextResponse.json(
        { error: 'Failed to retrieve business profile.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      business: data || null,
      hasBusiness: !!data,
    });
  } catch (err: any) {
    console.error('Business GET error:', err);
    return NextResponse.json(
      { error: 'Internal server error while fetching business profile.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/business
 * Creates or updates the business profile for the authenticated user (upsert).
 */
export async function POST(req: NextRequest) {
  try {
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

    // Server-side validation
    const validation = validateBusinessPayload(body);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    const payload = {
      user_id: user.id,
      business_name: body.business_name.trim(),
      business_type: body.business_type ? String(body.business_type).trim() : null,
      phone: body.phone ? String(body.phone).trim() : null,
      email: body.email ? String(body.email).trim() : null,
      gstin: body.gstin ? String(body.gstin).trim().toUpperCase() : null,
      address: body.address ? String(body.address).trim() : null,
      city: body.city ? String(body.city).trim() : null,
      state: body.state ? String(body.state).trim() : null,
      pincode: body.pincode ? String(body.pincode).trim() : null,
      logo_url: body.logo_url ? String(body.logo_url).trim() : null,
      updated_at: new Date().toISOString(),
    };

    // Upsert into businesses table (user_id is UNIQUE)
    const { data, error } = await supabase
      .from('businesses')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      console.error('Supabase business upsert error:', error.message);
      return NextResponse.json(
        { error: error.message || 'Failed to save business profile.' },
        { status: 400 }
      );
    }

    // Also update auth user metadata for convenience and fast middleware sync
    await supabase.auth.updateUser({
      data: {
        business_name: payload.business_name,
        onboarded: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        business: data,
        message: 'Business profile saved successfully.',
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('Business POST error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error while saving business profile.' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/business
 * Alias to POST (upsert)
 */
export async function PUT(req: NextRequest) {
  return POST(req);
}
