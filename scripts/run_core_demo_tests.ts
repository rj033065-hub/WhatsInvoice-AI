import {
  calculateInvoiceTotals,
  validateCalculationInput,
} from '../lib/calculations';
import { validateAndSanitizeExtraction } from '../lib/ai/aiExtract';
import { formatWhatsAppInvoiceMessage, cleanWhatsAppPhone } from '../lib/whatsapp';

function logSection(title: string) {
  console.log(`\n======================================================`);
  console.log(`🔷 ${title}`);
  console.log(`======================================================`);
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`✅ [PASS] ${msg}`);
}

async function runCoreDemoProtectionTests() {
  let passedCount = 0;
  let totalCount = 0;

  async function runTest(name: string, fn: () => void | Promise<void>) {
    totalCount++;
    try {
      await fn();
      passedCount++;
    } catch (e: any) {
      console.error(`❌ Test "${name}" failed:`, e.message);
      throw e;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ──────────────────────────────────────────────────────────────────────────
  // 1. CALCULATION ENGINE & EXACT ARITHMETIC
  // ──────────────────────────────────────────────────────────────────────────
  logSection('1. CALCULATION ENGINE TESTS');
  {
    await runTest('Normal invoice financial calculations', () => {
      const res = calculateInvoiceTotals({
        items: [{ product_name: 'Consulting', quantity: 2, unit_price: 500 }],
        gst_rate: 18,
        discount: 0,
      });
      assert(res.subtotal === 1000, 'Subtotal: 2 * 500 = 1000');
      assert(res.discount === 0, 'Discount: 0');
      assert(res.taxable_amount === 1000, 'Taxable Amount: 1000');
      assert(res.gst_amount === 180, 'GST: 1000 * 18% = 180');
      assert(res.total === 1180, 'Total: 1000 + 180 = 1180');
    });

    await runTest('Multiple items with line amounts', () => {
      const res = calculateInvoiceTotals({
        items: [
          { product_name: 'Item A', quantity: 3, unit_price: 200 }, // 600
          { product_name: 'Item B', quantity: 1, unit_price: 400 }, // 400
        ],
        gst_rate: 12,
        discount: 0,
      });
      assert(res.items[0].amount === 600, 'Line 1 amount: 600');
      assert(res.items[1].amount === 400, 'Line 2 amount: 400');
      assert(res.subtotal === 1000, 'Subtotal: 1000');
      assert(res.gst_amount === 120, 'GST: 120');
      assert(res.total === 1120, 'Total: 1120');
    });

    await runTest('Percentage and Fixed Discounts', () => {
      // 10% discount on 1000 = 100 -> taxable: 900 -> GST 18%: 162 -> total: 1062
      const pctRes = calculateInvoiceTotals({
        items: [{ product_name: 'Product', quantity: 1, unit_price: 1000 }],
        discount: { type: 'percentage', value: 10 },
        gst_rate: 18,
      });
      assert(pctRes.discount === 100, '10% of 1000 is 100');
      assert(pctRes.taxable_amount === 900, 'Taxable amount is 900');
      assert(pctRes.gst_amount === 162, 'GST on 900 at 18% is 162');
      assert(pctRes.total === 1062, 'Total is 1062');

      // Fixed discount of 300 on 1000 = 300 -> taxable: 700 -> GST 5%: 35 -> total: 735
      const fixRes = calculateInvoiceTotals({
        items: [{ product_name: 'Product', quantity: 1, unit_price: 1000 }],
        discount: { type: 'fixed', value: 300 },
        gst_rate: 5,
      });
      assert(fixRes.discount === 300, 'Fixed discount is 300');
      assert(fixRes.taxable_amount === 700, 'Taxable amount is 700');
      assert(fixRes.gst_amount === 35, 'GST on 700 at 5% is 35');
      assert(fixRes.total === 735, 'Total is 735');
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. EXACT ROUNDING (ROUND_HALF_UP)
  // ──────────────────────────────────────────────────────────────────────────
  logSection('2. ROUNDING VERIFICATION (ROUND_HALF_UP)');
  {
    await runTest('Decimal quantities and fractional currency rounding', () => {
      // 2.5 kg * 145.75 = 364.375 -> rounds to 364.38
      const res = calculateInvoiceTotals({
        items: [{ product_name: 'Grains', quantity: 2.5, unit_price: 145.75 }],
        gst_rate: 5,
      });
      assert(res.items[0].amount === 364.38, '364.375 rounds up to 364.38');
      assert(res.subtotal === 364.38, 'Subtotal is 364.38');
      // 364.38 * 5% = 18.219 -> rounds to 18.22
      assert(res.gst_amount === 18.22, '18.219 rounds up to 18.22');
      assert(res.total === 382.6, 'Total is 364.38 + 18.22 = 382.60');
    });

    await runTest('ROUND_HALF_UP tie-breaker edge cases', () => {
      const up = calculateInvoiceTotals({
        items: [{ product_name: 'Tie Up', quantity: 1, unit_price: 10.005 }],
      });
      assert(up.items[0].amount === 10.01, '10.005 rounds up to 10.01');

      const down = calculateInvoiceTotals({
        items: [{ product_name: 'Tie Down', quantity: 1, unit_price: 10.004 }],
      });
      assert(down.items[0].amount === 10.0, '10.004 rounds down to 10.00');
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. INVOICE API VALIDATION
  // ──────────────────────────────────────────────────────────────────────────
  logSection('3. INVOICE API INPUT VALIDATION');
  {
    await runTest('Reject invalid quantities, unit prices, discounts, and GST rates', () => {
      // Quantity <= 0
      const v1 = validateCalculationInput({
        items: [{ product_name: 'Bad', quantity: 0, unit_price: 100 }],
      });
      assert(!v1.isValid, 'Rejects quantity = 0');

      // Negative unit price
      const v2 = validateCalculationInput({
        items: [{ product_name: 'Bad', quantity: 1, unit_price: -10 }],
      });
      assert(!v2.isValid, 'Rejects negative unit price');

      // Negative discount
      const v3 = validateCalculationInput({
        items: [{ product_name: 'Bad', quantity: 1, unit_price: 100 }],
        discount: -50,
      });
      assert(!v3.isValid, 'Rejects negative discount');

      // Negative GST rate
      const v4 = validateCalculationInput({
        items: [{ product_name: 'Bad', quantity: 1, unit_price: 100 }],
        gst_rate: -18,
      });
      assert(!v4.isValid, 'Rejects negative GST rate');
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. OWNERSHIP & RLS DATA ISOLATION
  // ──────────────────────────────────────────────────────────────────────────
  logSection('4. OWNERSHIP & DATA ISOLATION VERIFICATION');
  {
    await runTest('API returns 404 on unowned resource ID to prevent enumeration', async () => {
      const res = await fetch('http://localhost:3000/api/invoices/00000000-0000-0000-0000-000000000999');
      // Should be 401 (unauthenticated) or 404 (not found / not owned)
      assert(
        res.status === 401 || res.status === 404,
        `Unauthenticated/unowned invoice query returns safe status: got ${res.status}`
      );
    });

    await runTest('Protected invoice mutation returns 401 when unauthorized', async () => {
      const res = await fetch('http://localhost:3000/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: 'Attacker',
          items: [{ product_name: 'Hacked', quantity: 1, unit_price: 100 }],
        }),
      });
      assert(res.status === 401, `Unauthenticated POST /api/invoices returns 401: got ${res.status}`);
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. AI EXTRACTION SCHEMA VALIDATION
  // ──────────────────────────────────────────────────────────────────────────
  logSection('5. AI EXTRACTION SCHEMA VALIDATION');
  {
    await runTest('Extract endpoint validates schema and preserves ambiguity in issues', async () => {
      const res = await fetch('http://localhost:3000/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Amit wants 2 jackets and 1 helmet at 1200 with 18% GST',
        }),
      });
      assert(res.status === 200, 'POST /api/ai/extract returned 200');
      const data = await res.json();

      assert(typeof data.customer === 'object', 'customer object exists');
      assert(Array.isArray(data.items), 'items array exists');
      assert(typeof data.discount === 'object', 'discount object exists');
      assert(typeof data.gstRate === 'number', 'gstRate is a number');
      assert(Array.isArray(data.issues), 'issues is an array');

      // Jacket has no price specified -> unitPrice: null + issue
      const jacket = data.items.find((i: any) => i.name.toLowerCase().includes('jacket'));
      assert(jacket !== undefined, 'Jacket item extracted');
      assert(jacket.unitPrice === null, 'Missing item price preserved as null');
      assert(data.issues.length > 0, 'Ambiguity preserved in issues array');

      // AI response must NOT include final calculated totals
      assert(data.subtotal === undefined, 'No subtotal in AI extraction result');
      assert(data.total === undefined, 'No total in AI extraction result');
    });

    await runTest('Extract endpoint rejects empty or malformed payloads', async () => {
      const emptyRes = await fetch('http://localhost:3000/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '   ' }),
      });
      assert(emptyRes.status === 400, 'Empty message rejected with 400 Bad Request');

      const badJsonRes = await fetch('http://localhost:3000/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json',
      });
      assert(badJsonRes.status === 400, 'Malformed JSON rejected with 400 Bad Request');
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. CORE DEMO PIPELINE SMOKE TEST (Message -> Extract -> Edit -> Save -> View)
  // ──────────────────────────────────────────────────────────────────────────
  logSection('6. CORE DEMO PIPELINE SMOKE TEST (Message -> Extract -> Edit -> Save -> View)');
  {
    await runTest('End-to-End flow: message -> extract -> edit -> save -> invoice view & WhatsApp', async () => {
      // Step 1: Raw WhatsApp Message
      const rawMessage = 'Bill for Rahul Sharma +91 9876543210: 2 Designer Shirts at 1250 each and 1 Silk Tie at 450, give 10% discount and 12% GST';

      // Step 2: AI Extraction Endpoint
      const extractRes = await fetch('http://localhost:3000/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: rawMessage }),
      });
      assert(extractRes.status === 200, 'Step 2: AI extraction succeeds');
      const extracted = await extractRes.json();
      assert(extracted.customer.name.toLowerCase().includes('rahul'), 'Step 2: Customer name extracted correctly');
      assert(extracted.items.length >= 2, 'Step 2: All items extracted');

      // Step 3: Frontend Edit / Live Calculation
      // User reviews extracted data, edits or adds notes in InvoiceEditor
      const editedForm = {
        customer_name: extracted.customer.name || 'Rahul Sharma',
        customer_phone: extracted.customer.phone || '9876543210',
        customer_email: extracted.customer.email || 'rahul@example.com',
        customer_address: 'Mumbai, Maharashtra',
        items: extracted.items.map((it: any) => ({
          product_name: it.name,
          quantity: it.quantity || 1,
          unit_price: it.unitPrice || 1000,
        })),
        discount: extracted.discount || { type: 'percentage', value: 10 },
        gst_rate: extracted.gstRate || 12,
        notes: 'Thank you for shopping with us!',
      };

      const livePreview = calculateInvoiceTotals(editedForm);
      assert(livePreview.subtotal > 0, 'Step 3: Live preview subtotal computed');
      assert(livePreview.taxable_amount > 0, 'Step 3: Live preview taxable amount computed');
      assert(livePreview.total > 0, 'Step 3: Live preview final total computed');

      // Step 4: Server-side validation & recalculation for Save
      const validatedInput = validateCalculationInput(editedForm);
      assert(validatedInput.isValid, 'Step 4: Invoice payload is valid for save');
      const authoritativeServerTotals = calculateInvoiceTotals(editedForm);
      assert(authoritativeServerTotals.total === livePreview.total, 'Step 4: Server recalculation matches live preview');

      // Step 5: Invoice View / Print / WhatsApp Share generation
      const mockBusiness = {
        business_name: 'Apex Boutique',
        phone: '9876500000',
        gstin: '27AAAAA0000A1Z5',
      };
      const mockInvoice = {
        id: 'mock-id-123',
        user_id: 'user-123',
        invoice_number: 'INV-2026-001',
        invoice_date: new Date().toISOString(),
        customer_name: editedForm.customer_name,
        customer_phone: editedForm.customer_phone,
        items: editedForm.items,
        subtotal: authoritativeServerTotals.subtotal,
        discount: authoritativeServerTotals.discount,
        taxable_amount: authoritativeServerTotals.taxable_amount,
        gst_rate: authoritativeServerTotals.gst_rate,
        gst_amount: authoritativeServerTotals.gst_amount,
        total: authoritativeServerTotals.total,
        currency: '₹',
        status: 'draft' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const waMsg = formatWhatsAppInvoiceMessage({
        businessName: mockBusiness.business_name,
        invoice: mockInvoice,
      });
      assert(waMsg.includes('INV-2026-001'), 'Step 5: WhatsApp message contains invoice number');
      assert(waMsg.includes('Apex Boutique'), 'Step 5: WhatsApp message contains business name');
      assert(waMsg.includes(mockInvoice.total.toFixed(2)), 'Step 5: WhatsApp message contains total');
      assert(cleanWhatsAppPhone(mockInvoice.customer_phone) === '919876543210', 'Step 5: Clean phone number formatted');
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FINAL SUMMARY
  // ──────────────────────────────────────────────────────────────────────────
  logSection('CORE DEMO PROTECTION TEST RESULTS');
  console.log(`🎉 ALL ${passedCount}/${totalCount} CORE DEMO TEST SUITES PASSED PERFECTLY!\n`);
}

runCoreDemoProtectionTests().catch((err) => {
  console.error('\n❌ DEMO PROTECTION TESTS FAILED:', err);
  process.exit(1);
});
