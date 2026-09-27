import { NextRequest, NextResponse } from 'next/server';
import { runAIExtraction } from '@/lib/ai/aiExtract';
import { checkRateLimit } from '@/lib/security/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anonymous';
    const rateCheck = checkRateLimit(ip, { limit: 30, windowMs: 60 * 1000 });

    if (!rateCheck.isAllowed) {
      return NextResponse.json(
        { error: 'Too many extraction requests. Please wait a moment before trying again.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rateCheck.resetInMs / 1000)) } }
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

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Request body must be a valid JSON object.' },
        { status: 400 }
      );
    }

    // Support both "message" (canonical) and "rawMessage" (legacy fallback)
    const rawInput = body.message !== undefined ? body.message : body.rawMessage;

    if (rawInput === undefined || rawInput === null || typeof rawInput !== 'string' || !rawInput.trim()) {
      return NextResponse.json(
        { error: 'Message is required and must be a non-empty string.' },
        { status: 400 }
      );
    }

    const message = rawInput.trim();

    // Enforce reasonable length limits
    if (message.length > 10000) {
      return NextResponse.json(
        { error: 'Message exceeds maximum supported length (10,000 characters).' },
        { status: 400 }
      );
    }

    // Run AI extraction engine (safe fallback, schema validated, no totals calculated)
    const extractedData = await runAIExtraction(message);

    return NextResponse.json(extractedData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    // Note: Do not log message or leak internal keys
    const isTimeout = error?.name === 'AbortError' || error?.code === 'ETIMEDOUT';
    return NextResponse.json(
      {
        error: isTimeout
          ? 'Extraction request timed out. Please try again.'
          : 'An error occurred while processing the extraction request.',
      },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
