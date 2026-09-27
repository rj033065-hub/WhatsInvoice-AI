import Decimal from 'decimal.js';
import { InvoiceItem } from './types/invoice';

// Configure Decimal.js precision and rounding mode consistently for financial calculations
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type DiscountType = 'percentage' | 'fixed';

export interface DiscountInput {
  type?: DiscountType;
  value: number | string;
}

export interface CalculationLineItemInput {
  product_name?: string;
  name?: string;
  quantity: number | string;
  unit_price?: number | string;
  unitPrice?: number | string;
}

export interface CalculationInput {
  items: CalculationLineItemInput[];
  gst_rate?: number | string;
  gstRate?: number | string;
  discount?: number | string | DiscountInput;
  discount_type?: DiscountType;
}

export interface CalculatedInvoiceTotals {
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  taxable_amount: number;
  gst_rate: number;
  gst_amount: number;
  total: number;
}

export class CalculationValidationError extends Error {
  public readonly validationErrors: string[];

  constructor(errors: string[]) {
    super(`Calculation validation failed: ${errors.join(', ')}`);
    this.name = 'CalculationValidationError';
    this.validationErrors = errors;
  }
}

/**
 * Validates calculation inputs according to business rules:
 * - quantity > 0
 * - unit price >= 0
 * - discount >= 0
 * - GST rate >= 0
 */
export function validateCalculationInput(input: CalculationInput): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input || !Array.isArray(input.items) || input.items.length === 0) {
    errors.push('At least one item is required for invoice calculation.');
  } else {
    input.items.forEach((item, idx) => {
      const itemLabel = item.product_name || item.name || `Item #${idx + 1}`;
      
      // Validate quantity > 0
      try {
        const qtyDec = new Decimal(item.quantity ?? 0);
        if (qtyDec.isNaN() || qtyDec.lessThanOrEqualTo(0)) {
          errors.push(`Invalid quantity for "${itemLabel}": quantity must be greater than 0.`);
        }
      } catch {
        errors.push(`Invalid quantity for "${itemLabel}": must be a valid number.`);
      }

      // Validate unit_price >= 0
      try {
        const priceVal = item.unit_price !== undefined ? item.unit_price : item.unitPrice ?? 0;
        const priceDec = new Decimal(priceVal);
        if (priceDec.isNaN() || priceDec.lessThan(0)) {
          errors.push(`Invalid unit price for "${itemLabel}": unit price must be greater than or equal to 0.`);
        }
      } catch {
        errors.push(`Invalid unit price for "${itemLabel}": must be a valid number.`);
      }
    });
  }

  // Validate GST rate >= 0
  const rawGst = input.gst_rate !== undefined ? input.gst_rate : input.gstRate ?? 0;
  try {
    const gstDec = new Decimal(rawGst);
    if (gstDec.isNaN() || gstDec.lessThan(0)) {
      errors.push('Invalid GST rate: GST rate must be greater than or equal to 0.');
    }
  } catch {
    errors.push('Invalid GST rate: must be a valid number.');
  }

  // Validate discount >= 0
  let discountVal: number | string = 0;
  if (input.discount && typeof input.discount === 'object') {
    discountVal = input.discount.value ?? 0;
  } else if (input.discount !== undefined && input.discount !== null) {
    discountVal = input.discount;
  }

  try {
    const discDec = new Decimal(discountVal);
    if (discDec.isNaN() || discDec.lessThan(0)) {
      errors.push('Invalid discount: discount must be greater than or equal to 0.');
    }
  } catch {
    errors.push('Invalid discount: must be a valid number.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Reusable Calculation Engine using Decimal.js with ROUND_HALF_UP.
 *
 * Rules:
 *   1. line amount = quantity × unit price (rounded to 2 decimal places)
 *   2. subtotal = sum(line amounts)
 *   3. discount = according to selected discount type (percentage or fixed amount)
 *   4. taxable amount = subtotal - discount
 *   5. GST amount = taxable amount × GST rate / 100 (rounded to 2 decimal places)
 *   6. total = taxable amount + GST amount (rounded to 2 decimal places)
 *
 * CRITICAL RULE:
 *   AI extracts data; application code calculates money.
 *   Never trust client-sent totals — recalculate server-side before saving/updating.
 */
export function calculateInvoiceTotals(
  input: CalculationInput,
  options: { throwOnError?: boolean } = { throwOnError: false }
): CalculatedInvoiceTotals {
  const validation = validateCalculationInput(input);
  if (!validation.isValid && options.throwOnError) {
    throw new CalculationValidationError(validation.errors);
  }

  let subtotalDec = new Decimal(0);

  // 1. Calculate each line amount: quantity × unit price
  const calculatedItems: InvoiceItem[] = (input.items || []).map((item) => {
    let qtyDec = new Decimal(0);
    try {
      const q = new Decimal(item.quantity ?? 1);
      qtyDec = q.greaterThan(0) ? q : new Decimal(1);
    } catch {
      qtyDec = new Decimal(1);
    }

    let priceDec = new Decimal(0);
    try {
      const p = new Decimal(item.unit_price !== undefined ? item.unit_price : item.unitPrice ?? 0);
      priceDec = p.greaterThanOrEqualTo(0) ? p : new Decimal(0);
    } catch {
      priceDec = new Decimal(0);
    }

    // Line amount = quantity × unit price, rounded half up to 2 decimal places
    const lineAmountDec = qtyDec.times(priceDec).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    subtotalDec = subtotalDec.plus(lineAmountDec);

    const productName = (item.product_name || item.name || '').trim() || 'Item';

    return {
      product_name: productName,
      quantity: qtyDec.toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber(),
      unit_price: priceDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber(),
      amount: lineAmountDec.toNumber(),
    };
  });

  const subtotal = subtotalDec.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();

  // 2. Determine discount according to discount type
  let discountType: DiscountType = input.discount_type || 'fixed';
  let rawDiscountVal = new Decimal(0);

  if (input.discount && typeof input.discount === 'object') {
    discountType = input.discount.type || 'percentage';
    try {
      rawDiscountVal = new Decimal(input.discount.value || 0);
    } catch {
      rawDiscountVal = new Decimal(0);
    }
  } else if (input.discount !== undefined && input.discount !== null) {
    try {
      rawDiscountVal = new Decimal(input.discount);
    } catch {
      rawDiscountVal = new Decimal(0);
    }
  }

  if (rawDiscountVal.lessThan(0)) {
    rawDiscountVal = new Decimal(0);
  }

  let discountDec = new Decimal(0);
  if (discountType === 'percentage') {
    // Percentage discount on subtotal
    discountDec = subtotalDec
      .times(rawDiscountVal.dividedBy(100))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  } else {
    // Fixed amount discount
    discountDec = rawDiscountVal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  // Discount cannot exceed subtotal
  if (discountDec.greaterThan(subtotalDec)) {
    discountDec = subtotalDec;
  }

  const discount = discountDec.toNumber();

  // 3. Taxable amount = subtotal - discount
  const taxableAmountDec = Decimal.max(0, subtotalDec.minus(discountDec)).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP
  );
  const taxable_amount = taxableAmountDec.toNumber();

  // 4. GST amount = taxable amount × GST rate / 100
  let gstRateDec = new Decimal(0);
  const rawGst = input.gst_rate !== undefined ? input.gst_rate : input.gstRate ?? 0;
  try {
    const g = new Decimal(rawGst);
    gstRateDec = g.greaterThanOrEqualTo(0) ? g : new Decimal(0);
  } catch {
    gstRateDec = new Decimal(0);
  }

  const gstAmountDec = taxableAmountDec
    .times(gstRateDec.dividedBy(100))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const gst_amount = gstAmountDec.toNumber();

  // 5. Total = taxable amount + GST amount
  const totalDec = taxableAmountDec.plus(gstAmountDec).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const total = totalDec.toNumber();

  return {
    items: calculatedItems,
    subtotal,
    discount,
    taxable_amount,
    gst_rate: gstRateDec.toNumber(),
    gst_amount,
    total,
  };
}
