/**
 * AI Message Extraction Engine for WhatsInvoice AI
 *
 * Adheres strictly to the following rules:
 * 1. Extract ONLY information present in the message.
 * 2. Do NOT invent prices or identities (use null / empty string).
 * 3. Default quantity to 1 ONLY when quantity is absent.
 * 4. Preserve ambiguity and missing details in the `issues` array.
 * 5. Validate schema server-side before returning.
 * 6. Never calculate final invoice totals (subtotal/gst_amount/total).
 * 7. Never log sensitive message contents or expose API keys.
 */

export interface ExtractedCustomer {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

export interface ExtractedItem {
  name: string;
  quantity: number;
  unitPrice: number | null;
}

export interface ExtractedDiscount {
  type: 'percentage' | 'fixed';
  value: number;
}

export interface AIExtractionOutput {
  customer: ExtractedCustomer;
  items: ExtractedItem[];
  discount: ExtractedDiscount;
  gstRate: number;
  notes: string | null;
  issues: string[];
}

/**
 * Validates and sanitizes extraction output to ensure it matches the exact contract.
 */
export function validateAndSanitizeExtraction(data: any): AIExtractionOutput {
  const issues: string[] = Array.isArray(data?.issues)
    ? data.issues.filter((i: any) => typeof i === 'string' && i.trim().length > 0)
    : [];

  // Customer validation
  const rawCustomer = data?.customer || {};
  const customerName = typeof rawCustomer.name === 'string' ? rawCustomer.name.trim() : '';
  const customerPhone = typeof rawCustomer.phone === 'string' && rawCustomer.phone.trim()
    ? rawCustomer.phone.trim()
    : null;
  const customerEmail = typeof rawCustomer.email === 'string' && rawCustomer.email.trim()
    ? rawCustomer.email.trim()
    : null;
  const customerAddress = typeof rawCustomer.address === 'string' && rawCustomer.address.trim()
    ? rawCustomer.address.trim()
    : null;

  if (!customerName && !issues.some((i) => i.toLowerCase().includes('customer') || i.toLowerCase().includes('name'))) {
    issues.push('Customer name is not specified in the message.');
  }

  const customer: ExtractedCustomer = {
    name: customerName,
    phone: customerPhone,
    email: customerEmail,
    address: customerAddress,
  };

  // Items validation
  const rawItems = Array.isArray(data?.items) ? data.items : [];
  const items: ExtractedItem[] = [];

  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== 'object') continue;

    const name = typeof rawItem.name === 'string' && rawItem.name.trim()
      ? rawItem.name.trim()
      : typeof rawItem.product_name === 'string' && rawItem.product_name.trim()
      ? rawItem.product_name.trim()
      : '';

    // Quantity: default to 1 only when absent or invalid
    let quantity = 1;
    if (rawItem.quantity !== undefined && rawItem.quantity !== null && !isNaN(Number(rawItem.quantity))) {
      const q = Number(rawItem.quantity);
      if (q > 0) quantity = q;
    }

    // Unit Price: must be number or null if missing (DO NOT INVENT)
    let unitPrice: number | null = null;
    const rawPrice = rawItem.unitPrice !== undefined ? rawItem.unitPrice : rawItem.unit_price;
    if (rawPrice !== undefined && rawPrice !== null && !isNaN(Number(rawPrice))) {
      unitPrice = Number(rawPrice);
    } else {
      if (name && !issues.some((i) => i.toLowerCase().includes(`price`) && i.includes(name))) {
        issues.push(`Price for item "${name}" was not specified in the message.`);
      }
    }

    if (name || unitPrice !== null) {
      items.push({ name, quantity, unitPrice });
    }
  }

  if (items.length === 0) {
    issues.push('No product or service items could be identified in the message.');
    items.push({ name: '', quantity: 1, unitPrice: null });
  }

  // Discount validation
  let discountType: 'percentage' | 'fixed' = 'percentage';
  let discountValue = 0;

  if (data?.discount && typeof data.discount === 'object') {
    if (data.discount.type === 'fixed' || data.discount.type === 'percentage') {
      discountType = data.discount.type;
    }
    if (!isNaN(Number(data.discount.value)) && Number(data.discount.value) >= 0) {
      discountValue = Number(data.discount.value);
    }
  } else if (!isNaN(Number(data?.discount)) && Number(data.discount) >= 0) {
    discountValue = Number(data.discount);
  }

  // GST Rate: default 18 unless specified
  let gstRate = 18;
  const rawGst = data?.gstRate !== undefined ? data.gstRate : data?.gst_rate;
  if (rawGst !== undefined && rawGst !== null && !isNaN(Number(rawGst)) && Number(rawGst) >= 0) {
    gstRate = Number(rawGst);
  }

  // Notes
  const notes = typeof data?.notes === 'string' && data.notes.trim() ? data.notes.trim() : null;

  return {
    customer,
    items,
    discount: {
      type: discountType,
      value: discountValue,
    },
    gstRate,
    notes,
    issues,
  };
}

/**
 * Rule-based fallback extractor when LLM is unavailable or times out.
 */
export function extractRuleBased(message: string): AIExtractionOutput {
  const issues: string[] = [];

  // 1. Phone extraction
  const phoneMatch = message.match(/(?:mobile|phone|ph|num|number)?\s*:?\s*(\+?\d{1,3}\s*\d{10}|\+?\d{10,12})/i);
  const phone = phoneMatch ? phoneMatch[1].replace(/\s+/g, '') : null;

  // 2. Email extraction
  const emailMatch = message.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const email = emailMatch ? emailMatch[1] : null;

  // 3. Customer name extraction
  let customerName = '';
  const nameLabelMatch = message.match(/(?:customer|client|bill to|bill for|invoice for|name)\s*:?\s*([A-Za-z\s]{2,30}?)(?=\s*(?:\+?\d|\bmobile\b|\bphone\b|\bneeds\b|\bko\b|\bbhai\b|\bat\b|:|;|\n|,|$))/i);
  if (nameLabelMatch && nameLabelMatch[1].trim()) {
    customerName = nameLabelMatch[1].trim();
  } else {
    // E.g. "Rahul Sharma mobile ..." or "Rahul Sharma needs ..."
    const nameMatch =
      message.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:mobile|phone|needs|ko|bhai|for)/i) ||
      message.match(/(?:needs|ko|for|client|customer)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);

    if (nameMatch?.[1] && !['bhai', 'hi', 'hello', 'please', 'gst', 'send', 'invoice', 'order', 'bill'].includes(nameMatch[1].toLowerCase())) {
      customerName = nameMatch[1].trim();
    } else {
      issues.push('Customer name not found in message.');
    }
  }

  // 4. GST Rate extraction (default to 18 if not specified)
  let gstRate = 18;
  const gstMatch = message.match(/(?:gst|tax|vat)\s*:?\s*(\d+(?:\.\d+)?)\s*%?/i) ||
                   message.match(/(\d+(?:\.\d+)?)\s*%\s*(?:gst|tax|vat)/i);
  if (gstMatch) {
    gstRate = parseFloat(gstMatch[1]);
  }

  // 5. Discount extraction
  let discount: ExtractedDiscount = { type: 'percentage', value: 0 };
  const discMatch = message.match(/(\d+(?:\.\d+)?)\s*%\s*(?:off|discount)/i);
  if (discMatch) {
    discount = { type: 'percentage', value: parseFloat(discMatch[1]) };
  } else {
    const flatDiscMatch = message.match(/(?:flat\s+discount|discount\s+of|less)\s*(?:rs\.?|inr)?\s*(\d+)/i);
    if (flatDiscMatch) {
      discount = { type: 'fixed', value: parseFloat(flatDiscMatch[1]) };
    }
  }

  // 6. Line Items extraction
  // Clean off customer greeting, phone, gst, discount from items parsing
  let itemText = message
    .replace(/(?:mobile|phone|ph)\s*:?\s*\+?\d{10,12}/gi, '')
    .replace(/(?:gst|tax|vat)\s*:?\s*\d+(?:\.\d+)?\s*%?/gi, '')
    .replace(/\d+(?:\.\d+)?\s*%\s*(?:off|discount)/gi, '')
    .replace(/(?:flat\s+discount|discount\s+of|less)\s*(?:rs\.?|inr)?\s*\d+/gi, '')
    .replace(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:needs|ko|for|chahiye)\s*/i, '');

  const items: ExtractedItem[] = [];
  const lines = itemText.split(/(?:\n|and|aur|\+|,)/i);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || /^(hi|hello|please|thanks|thank you|regards)/i.test(trimmed)) continue;

    // Pattern A: "2 Nike shoes at 2500" or "2 boxes of pens @ 50"
    const m1 = trimmed.match(/(?:send|order|want|needs|buy)?\s*(\d+(?:\.\d+)?)\s+(?:pcs|boxes|kg|nos|items|units|pairs)?\s*([a-zA-Z0-9\s-]+?)\s+(?:at|@|for|rs\.?|rupees|inr|price)\s*:?\s*(\d+(?:\.\d+)?)/i);
    if (m1) {
      const qty = parseFloat(m1[1]) || 1;
      const name = m1[2].replace(/\b(ko|needs|dena|chahiye|de|do|for|please|send)\b/gi, '').trim();
      const price = parseFloat(m1[3]);
      if (name && !['gst', 'tax', 'discount', 'total', 'mobile', 'phone'].includes(name.toLowerCase())) {
        items.push({ name, quantity: qty, unitPrice: isNaN(price) ? null : price });
        continue;
      }
    }

    // Pattern B: "Nike shoes: 2500" or "Nike shoes 2500"
    const m2 = trimmed.match(/([a-zA-Z\s-]+?)\s*(?:at|@|:|rs\.?|inr)\s*(\d+(?:\.\d+)?)/i);
    if (m2 && m2[1].trim().length > 2) {
      const name = m2[1].replace(/\b(ko|needs|dena|chahiye|de|do|for|please|send)\b/gi, '').trim();
      const price = parseFloat(m2[2]);
      if (name && !['gst', 'tax', 'discount', 'total', 'mobile', 'phone', 'hi', 'hello'].includes(name.toLowerCase())) {
        items.push({ name, quantity: 1, unitPrice: isNaN(price) ? null : price });
        continue;
      }
    }

    // Pattern C: "2 leather jackets" or "leather jacket x 2" (no price present)
    const m3 = trimmed.match(/(?:send|buy|need)?\s*(\d+)\s+([a-zA-Z\s-]+)/i) ||
               trimmed.match(/([a-zA-Z\s-]+)\s*x\s*(\d+)/i);
    if (m3) {
      const qty = parseInt(m3[1], 10) || parseInt(m3[2], 10) || 1;
      const name = (isNaN(parseInt(m3[1], 10)) ? m3[1] : m3[2])
        .replace(/\b(ko|needs|dena|chahiye|de|do|for|please|send)\b/gi, '')
        .trim();
      if (name && name.length > 2 && !['gst', 'tax', 'discount', 'total', 'mobile', 'phone', 'hi', 'hello'].includes(name.toLowerCase())) {
        items.push({ name, quantity: qty, unitPrice: null });
        issues.push(`Price for "${name}" was not mentioned in the message.`);
        continue;
      }
    }
  }

  if (items.length === 0) {
    items.push({ name: '', quantity: 1, unitPrice: null });
    issues.push('No line items could be extracted from the message.');
  }

  return validateAndSanitizeExtraction({
    customer: {
      name: customerName,
      phone,
      email,
      address: null,
    },
    items,
    discount,
    gstRate,
    notes: null,
    issues,
  });
}

/**
 * Main AI extraction routine with timeout, provider handling, and safe fallback.
 */
export async function runAIExtraction(message: string): Promise<AIExtractionOutput> {
  const apiKey =
    process.env.LLM_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return extractRuleBased(message);
  }

  // 8-second timeout for LLM calls
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const prompt = `You are a high-precision invoice extraction AI for WhatsInvoice AI.
Extract structured invoice data from this message.

STRICT EXTRACTION RULES:
1. Extract ONLY facts present in the text.
2. DO NOT invent customer names, emails, phones, or addresses. Use null or empty string if missing.
3. DO NOT invent prices. If price is absent, set unitPrice to null.
4. Default quantity to 1 ONLY when quantity is not mentioned.
5. If GST rate is specified (e.g., 18%, 5%), set gstRate. Default to 18 if not mentioned.
6. If discount is mentioned (e.g. "10% off" or "100 off"), set discount object { type: "percentage" | "fixed", value: number }. Default to { type: "percentage", value: 0 }.
7. Preserve every missing detail or ambiguity in the "issues" array (e.g. "Item price not specified", "Customer name not found").
8. The AI must NOT calculate final totals (no subtotal, tax amount, or total amount).
9. Output ONLY valid JSON matching this schema:
{
  "customer": {
    "name": "",
    "phone": null,
    "email": null,
    "address": null
  },
  "items": [
    {
      "name": "",
      "quantity": 1,
      "unitPrice": null
    }
  ],
  "discount": {
    "type": "percentage",
    "value": 0
  },
  "gstRate": 18,
  "notes": null,
  "issues": []
}

Input Message:
"""
${message}
"""`;

    let rawJson: any = null;

    if (apiKey.startsWith('AIza') || process.env.GEMINI_API_KEY) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
          }),
          signal: controller.signal,
        }
      );

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) rawJson = JSON.parse(text);
      }
    } else if (apiKey.startsWith('sk-') || process.env.OPENAI_API_KEY) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) rawJson = JSON.parse(text);
      }
    }

    if (rawJson) {
      return validateAndSanitizeExtraction(rawJson);
    }
  } catch (err: any) {
    // Provider failure, timeout, or malformed JSON — safely fall back
  } finally {
    clearTimeout(timeoutId);
  }

  // Graceful rule-based fallback
  return extractRuleBased(message);
}
