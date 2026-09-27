import {
  calculateInvoiceTotals,
  validateCalculationInput,
  CalculationValidationError,
} from '../lib/calculations';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASS: ${message}`);
}

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    console.error(`❌ FAIL: ${message} (Expected: ${expected}, Actual: ${actual})`);
    throw new Error(`Assertion failed: ${message} (Expected ${expected}, got ${actual})`);
  }
  console.log(`✅ PASS: ${message} (${actual})`);
}

function runTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING DECIMAL.JS CALCULATION ENGINE UNIT TESTS');
  console.log('======================================================\n');

  // 1. Normal Invoice: 1 item, 18% GST, 0 discount
  console.log('--- TEST 1: Normal Invoice ---');
  {
    const result = calculateInvoiceTotals({
      items: [{ product_name: 'Consulting Service', quantity: 1, unit_price: 1000 }],
      gst_rate: 18,
      discount: 0,
    });
    assertEqual(result.subtotal, 1000.0, 'Subtotal should be 1000.00');
    assertEqual(result.discount, 0.0, 'Discount should be 0.00');
    assertEqual(result.taxable_amount, 1000.0, 'Taxable amount should be 1000.00');
    assertEqual(result.gst_rate, 18, 'GST rate should be 18');
    assertEqual(result.gst_amount, 180.0, 'GST amount should be 180.00 (1000 * 18%)');
    assertEqual(result.total, 1180.0, 'Total should be 1180.00 (1000 + 180)');
  }

  // 2. Multiple Items
  console.log('\n--- TEST 2: Multiple Items ---');
  {
    const result = calculateInvoiceTotals({
      items: [
        { product_name: 'Item 1', quantity: 2, unit_price: 150 }, // 300
        { product_name: 'Item 2', quantity: 3, unit_price: 250 }, // 750
        { product_name: 'Item 3', quantity: 1, unit_price: 450 }, // 450
      ],
      gst_rate: 18,
      discount: 0,
    });
    assertEqual(result.items.length, 3, 'Items length should be 3');
    assertEqual(result.items[0].amount, 300.0, 'Item 1 line amount should be 300.00');
    assertEqual(result.items[1].amount, 750.0, 'Item 2 line amount should be 750.00');
    assertEqual(result.items[2].amount, 450.0, 'Item 3 line amount should be 450.00');
    assertEqual(result.subtotal, 1500.0, 'Subtotal should be 1500.00 (300 + 750 + 450)');
    assertEqual(result.gst_amount, 270.0, 'GST amount should be 270.00 (1500 * 18%)');
    assertEqual(result.total, 1770.0, 'Total should be 1770.00 (1500 + 270)');
  }

  // 3. Discount: Percentage vs Fixed Discount
  console.log('\n--- TEST 3: Discount (Percentage & Fixed) ---');
  {
    // 3a. Percentage Discount (10% off on 1000 = 100) -> Taxable: 900 -> GST 18% on 900 = 162 -> Total: 1062
    const pctResult = calculateInvoiceTotals({
      items: [{ product_name: 'Widget', quantity: 10, unit_price: 100 }], // 1000
      discount: { type: 'percentage', value: 10 },
      gst_rate: 18,
    });
    assertEqual(pctResult.subtotal, 1000.0, 'Subtotal should be 1000.00');
    assertEqual(pctResult.discount, 100.0, 'Percentage discount should be 100.00 (10% of 1000)');
    assertEqual(pctResult.taxable_amount, 900.0, 'Taxable amount should be 900.00');
    assertEqual(pctResult.gst_amount, 162.0, 'GST amount should be 162.00 (900 * 18%)');
    assertEqual(pctResult.total, 1062.0, 'Total should be 1062.00 (900 + 162)');

    // 3b. Fixed Discount (250 off on 1000) -> Taxable: 750 -> GST 12% on 750 = 90 -> Total: 840
    const fixedResult = calculateInvoiceTotals({
      items: [{ product_name: 'Widget', quantity: 10, unit_price: 100 }], // 1000
      discount: { type: 'fixed', value: 250 },
      gst_rate: 12,
    });
    assertEqual(fixedResult.discount, 250.0, 'Fixed discount should be 250.00');
    assertEqual(fixedResult.taxable_amount, 750.0, 'Taxable amount should be 750.00 (1000 - 250)');
    assertEqual(fixedResult.gst_amount, 90.0, 'GST amount should be 90.00 (750 * 12%)');
    assertEqual(fixedResult.total, 840.0, 'Total should be 840.00 (750 + 90)');
  }

  // 4. GST Rates (5%, 12%, 18%, 28%, 0%)
  console.log('\n--- TEST 4: GST Rates ---');
  {
    const subtotal = 1000;
    const rates = [0, 5, 12, 18, 28];
    const expectedGst = [0, 50, 120, 180, 280];

    rates.forEach((rate, i) => {
      const res = calculateInvoiceTotals({
        items: [{ product_name: 'Service', quantity: 1, unit_price: subtotal }],
        gst_rate: rate,
        discount: 0,
      });
      assertEqual(res.gst_amount, expectedGst[i], `GST amount for ${rate}% on 1000 should be ${expectedGst[i]}`);
      assertEqual(res.total, subtotal + expectedGst[i], `Total for ${rate}% GST should be ${subtotal + expectedGst[i]}`);
    });
  }

  // 5. Zero Discount
  console.log('\n--- TEST 5: Zero Discount ---');
  {
    const res = calculateInvoiceTotals({
      items: [{ product_name: 'Item', quantity: 5, unit_price: 200 }],
      gst_rate: 18,
      discount: 0,
    });
    assertEqual(res.discount, 0.0, 'Discount should be exactly 0.00');
    assertEqual(res.taxable_amount, 1000.0, 'Taxable amount equals subtotal when discount is zero');
    assertEqual(res.total, 1180.0, 'Total with 0 discount is subtotal + GST');
  }

  // 6. Decimal Quantities and Prices
  console.log('\n--- TEST 6: Decimal Quantities and Prices ---');
  {
    // 2.5 kg at 145.75 = 364.375 -> rounded half up to 364.38
    // 1.75 meters at 89.20 = 156.10
    // Subtotal = 364.38 + 156.10 = 520.48
    // GST 5% on 520.48 = 26.024 -> 26.02
    // Total = 546.50
    const res = calculateInvoiceTotals({
      items: [
        { product_name: 'Organic Rice', quantity: 2.5, unit_price: 145.75 },
        { product_name: 'Fabric', quantity: 1.75, unit_price: 89.20 },
      ],
      gst_rate: 5,
      discount: 0,
    });
    assertEqual(res.items[0].amount, 364.38, 'Line 1: 2.5 * 145.75 = 364.38 (ROUND_HALF_UP)');
    assertEqual(res.items[1].amount, 156.10, 'Line 2: 1.75 * 89.20 = 156.10');
    assertEqual(res.subtotal, 520.48, 'Subtotal: 364.38 + 156.10 = 520.48');
    assertEqual(res.gst_amount, 26.02, 'GST 5% on 520.48: 26.02');
    assertEqual(res.total, 546.50, 'Total: 520.48 + 26.02 = 546.50');
  }

  // 7. Exact Rounding Behavior (ROUND_HALF_UP)
  console.log('\n--- TEST 7: Rounding (ROUND_HALF_UP Verification) ---');
  {
    // Example: 1 item at 10.005 -> rounds to 10.01
    // Example: 1 item at 10.004 -> rounds to 10.00
    const resUp = calculateInvoiceTotals({
      items: [{ product_name: 'Round Up', quantity: 1, unit_price: 10.005 }],
      gst_rate: 0,
      discount: 0,
    });
    assertEqual(resUp.items[0].amount, 10.01, '10.005 rounds up to 10.01');

    const resDown = calculateInvoiceTotals({
      items: [{ product_name: 'Round Down', quantity: 1, unit_price: 10.004 }],
      gst_rate: 0,
      discount: 0,
    });
    assertEqual(resDown.items[0].amount, 10.00, '10.004 rounds down to 10.00');

    // Fractional GST rounding: 33.33 taxable * 18% = 5.9994 -> 6.00
    const resGstRound = calculateInvoiceTotals({
      items: [{ product_name: 'Fraction Item', quantity: 1, unit_price: 33.33 }],
      gst_rate: 18,
      discount: 0,
    });
    assertEqual(resGstRound.gst_amount, 6.00, '33.33 * 18% = 5.9994 rounds to 6.00');
    assertEqual(resGstRound.total, 39.33, 'Total is 33.33 + 6.00 = 39.33');
  }

  // 8. Invalid Values Validation
  console.log('\n--- TEST 8: Validation of Invalid Values ---');
  {
    // 8a. Quantity <= 0
    const valQtyZero = validateCalculationInput({
      items: [{ product_name: 'Bad Qty', quantity: 0, unit_price: 100 }],
    });
    assert(!valQtyZero.isValid, 'Quantity = 0 must fail validation');
    assert(valQtyZero.errors.some((e) => e.includes('quantity')), 'Error should specify quantity issue');

    const valQtyNeg = validateCalculationInput({
      items: [{ product_name: 'Bad Qty', quantity: -2, unit_price: 100 }],
    });
    assert(!valQtyNeg.isValid, 'Quantity < 0 must fail validation');

    // 8b. Unit Price < 0
    const valPriceNeg = validateCalculationInput({
      items: [{ product_name: 'Bad Price', quantity: 1, unit_price: -50 }],
    });
    assert(!valPriceNeg.isValid, 'Negative unit price must fail validation');
    assert(valPriceNeg.errors.some((e) => e.includes('unit price')), 'Error should specify unit price issue');

    // 8c. Negative Discount
    const valDiscNeg = validateCalculationInput({
      items: [{ product_name: 'Item', quantity: 1, unit_price: 100 }],
      discount: -10,
    });
    assert(!valDiscNeg.isValid, 'Negative discount must fail validation');

    // 8d. Negative GST Rate
    const valGstNeg = validateCalculationInput({
      items: [{ product_name: 'Item', quantity: 1, unit_price: 100 }],
      gst_rate: -5,
    });
    assert(!valGstNeg.isValid, 'Negative GST rate must fail validation');

    // 8e. throwOnError option in calculateInvoiceTotals
    let threw = false;
    try {
      calculateInvoiceTotals(
        {
          items: [{ product_name: 'Bad Item', quantity: -1, unit_price: 100 }],
        },
        { throwOnError: true }
      );
    } catch (e) {
      if (e instanceof CalculationValidationError) {
        threw = true;
      }
    }
    assert(threw, 'calculateInvoiceTotals with throwOnError: true throws CalculationValidationError on invalid input');
  }

  console.log('\n======================================================');
  console.log('🎉 ALL 8 UNIT TEST SUITES PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runTests();
