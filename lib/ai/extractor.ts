import { ExtractionResult } from '../types/invoice';

/**
 * Extracts structured invoice data from a raw WhatsApp text message.
 * Field names match the DB schema / ExtractionResult type exactly.
 *
 * CRITICAL RULES:
 * - AI extracts raw values only; application code calculates totals (Decimal.js).
 * - Missing/ambiguous data goes into the `issues` array — never invented.
 */
export async function extractInvoiceFromMessage(
  rawMessage: string,
  customApiKey?: string
): Promise<ExtractionResult> {
  const apiKey =
    customApiKey ||
    process.env.LLM_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.OPENAI_API_KEY;

  if (apiKey) {
    try {
      if (apiKey.startsWith('AIza') || process.env.GEMINI_API_KEY) {
        return await extractWithGemini(rawMessage, apiKey);
      } else if (apiKey.startsWith('sk-') || process.env.OPENAI_API_KEY) {
        return await extractWithOpenAI(rawMessage, apiKey);
      }
    } catch (err) {
      console.warn('LLM API extraction failed, falling back to smart parser:', err);
    }
  }

  return extractWithFallback(rawMessage);
}

async function extractWithGemini(rawMessage: string, apiKey: string): Promise<ExtractionResult> {
  const prompt = getExtractionPrompt(rawMessage);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textResult) throw new Error('Empty response from Gemini API');
  return cleanAndValidateResult(JSON.parse(textResult), rawMessage);
}

async function extractWithOpenAI(rawMessage: string, apiKey: string): Promise<ExtractionResult> {
  const prompt = getExtractionPrompt(rawMessage);
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const textResult = data.choices?.[0]?.message?.content;
  if (!textResult) throw new Error('Empty response from OpenAI API');
  return cleanAndValidateResult(JSON.parse(textResult), rawMessage);
}

function getExtractionPrompt(rawMessage: string): string {
  return `You are an expert invoice data extractor for WhatsInvoice AI.
Analyze the following raw WhatsApp message and extract raw customer details, line items, tax rate, and ambiguity issues.

CRITICAL RULES:
1. Extract customer name, phone, email (if any), line items (product_name, quantity, unit_price).
2. DO NOT compute subtotal, gst_amount, or total. Financial calculations are done server-side.
3. DO NOT invent missing customer details or item prices.
4. If customer phone is missing, add issue: "Customer phone number not found in message."
5. If customer name is missing, use "Guest Customer" and add issue: "Customer name not specified."
6. If an item price/quantity is missing, set unit_price: 0 and add an issue.
7. If GST/tax rate is mentioned (e.g. "GST 18%"), set gst_rate: 18. If omitted, set gst_rate: 0 and add issue.
8. Return ONLY valid JSON matching this structure exactly:
{
  "customer_name": "Name",
  "customer_phone": "Phone or null",
  "customer_email": null,
  "customer_address": null,
  "currency": "INR",
  "items": [
    { "product_name": "Item name", "quantity": 1, "unit_price": 100 }
  ],
  "gst_rate": 18,
  "discount": 0,
  "notes": "Extracted from message",
  "issues": ["Issue 1"]
}

WhatsApp Message:
"""
${rawMessage}
"""`;
}

/**
 * Smart Rule-Based Fallback Extractor
 * Handles Hinglish, numbers, quantities, GST, and mobile numbers without an LLM key.
 */
export function extractWithFallback(rawMessage: string): ExtractionResult {
  const issues: string[] = [];
  const items: { product_name: string; quantity: number; unit_price: number }[] = [];

  // Phone
  const phoneMatch = rawMessage.match(/(?:mobile|phone|ph|num|number)?\s*:?\s*(\+?\d{10,12})/i);
  const customer_phone = phoneMatch ? phoneMatch[1] : null;
  if (!customer_phone) issues.push('Customer phone number not found in message.');

  // Customer name
  let customer_name = 'Guest Customer';
  const nameMatch =
    rawMessage.match(/(?:needs|ko|for|client|customer|bhai|name:?)\s+([A-Z][a-z]+)/i) ||
    rawMessage.match(/^([A-Z][a-z]+)\b/);
  if (nameMatch?.[1] && !['bhai', 'hi', 'hello', 'please', 'gst'].includes(nameMatch[1].toLowerCase())) {
    customer_name = nameMatch[1];
  } else {
    const wordBefore = rawMessage.match(/\b([A-Za-z]+)\s+(?:needs|ko)\b/i);
    if (wordBefore?.[1] && !['bhai', 'hi', 'hello'].includes(wordBefore[1].toLowerCase())) {
      customer_name = wordBefore[1];
    } else {
      issues.push('Customer name not specified clearly (defaulted to Guest Customer).');
    }
  }

  // GST
  const gstMatch = rawMessage.match(/(?:gst|tax|vat)\s*:?\s*(\d+(?:\.\d+)?)\s*%?/i);
  let gst_rate = 0;
  if (gstMatch) {
    gst_rate = parseFloat(gstMatch[1]);
  } else {
    issues.push('GST/Tax rate not explicitly specified (defaulted to 0%).');
  }

  // Line items
  const lines = rawMessage.split(/(?:\n|and|aur|\.|,)/i);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || /^(mobile|gst|total|phone)/i.test(trimmed)) continue;

    // "2 Nike shoes at 2499"
    const m1 = trimmed.match(/(\d+)\s+([a-zA-Z\s]+?)\s+(?:at|@|wale|wali|rs|rupees|INR)?\s*(\d+)/i);
    if (m1) {
      const qty = parseInt(m1[1], 10);
      const name = m1[2].replace(/\b(ko|needs|dena|chahiye|de|do)\b/gi, '').trim();
      const price = parseFloat(m1[3]);
      if (name && qty > 0) {
        items.push({ product_name: name, quantity: qty, unit_price: price });
        continue;
      }
    }

    // "Nike shoes x 2 = 2499" or "Nike shoes: 2499"
    const m2 = trimmed.match(/([a-zA-Z\s]+?)\s*:?\s*(?:x\s*(\d+))?\s*(?:rs|@|at)?\s*(\d+)/i);
    if (m2 && m2[1].trim().length > 2) {
      const name = m2[1].replace(/\b(ko|needs|dena|bhai)\b/gi, '').trim();
      const qty = m2[2] ? parseInt(m2[2], 10) : 1;
      const price = parseFloat(m2[3]);
      if (name && price > 0 && !['gst', 'mobile', 'phone', 'total'].includes(name.toLowerCase())) {
        items.push({ product_name: name, quantity: qty, unit_price: price });
      }
    }
  }

  if (items.length === 0) {
    issues.push('Could not detect line items. Added placeholder.');
    items.push({ product_name: 'Custom Service / Item', quantity: 1, unit_price: 0 });
  }

  return {
    customer_name,
    customer_phone,
    customer_email: null,
    customer_address: null,
    currency: 'INR',
    items,
    gst_rate,
    discount: 0,
    notes: 'Parsed from WhatsApp message',
    issues,
  };
}

function cleanAndValidateResult(parsed: any, rawMessage: string): ExtractionResult {
  const issues: string[] = Array.isArray(parsed.issues) ? [...parsed.issues] : [];

  let customer_phone = parsed.customer_phone || null;
  if (!customer_phone) {
    const m = rawMessage.match(/(\+?\d{10,12})/);
    if (m) customer_phone = m[1];
    else if (!issues.some((i) => i.toLowerCase().includes('phone'))) {
      issues.push('Customer phone number not found in message.');
    }
  }

  let customer_name = parsed.customer_name || 'Guest Customer';
  if (customer_name === 'Guest Customer' && !issues.some((i) => i.toLowerCase().includes('name'))) {
    issues.push('Customer name not specified clearly.');
  }

  const items = Array.isArray(parsed.items)
    ? parsed.items.map((item: any) => ({
        product_name: String(item.product_name || item.description || 'Item'),
        quantity: Math.max(1, Number(item.quantity) || 1),
        unit_price: Math.max(0, Number(item.unit_price) || 0),
      }))
    : [];

  if (items.length === 0) issues.push('No line items could be extracted.');

  return {
    customer_name,
    customer_phone,
    customer_email: parsed.customer_email || null,
    customer_address: parsed.customer_address || null,
    currency: parsed.currency || 'INR',
    items,
    gst_rate: Number(parsed.gst_rate) || 0,
    discount: Number(parsed.discount) || 0,
    notes: parsed.notes || null,
    issues,
  };
}
