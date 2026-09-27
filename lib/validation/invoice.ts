import { Invoice } from '../types/invoice';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateInvoiceInput(input: Partial<Invoice>): ValidationResult {
  const errors: string[] = [];

  if (!input.customer_name || typeof input.customer_name !== 'string' || !input.customer_name.trim()) {
    errors.push('Customer name is required.');
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    errors.push('At least one line item is required.');
  } else {
    input.items.forEach((item, index) => {
      if (!item.product_name || !item.product_name.trim()) {
        errors.push(`Line item #${index + 1} must have a product name.`);
      }
      if (typeof item.quantity !== 'number' || isNaN(item.quantity) || item.quantity <= 0) {
        errors.push(`Line item #${index + 1} must have a valid quantity greater than 0.`);
      }
      if (typeof item.unit_price !== 'number' || isNaN(item.unit_price) || item.unit_price < 0) {
        errors.push(`Line item #${index + 1} must have a non-negative unit price.`);
      }
    });
  }

  if (input.gst_rate !== undefined && (typeof input.gst_rate !== 'number' || input.gst_rate < 0 || input.gst_rate > 100)) {
    errors.push('GST rate must be between 0 and 100.');
  }

  if (input.discount !== undefined && (typeof input.discount !== 'number' || input.discount < 0)) {
    errors.push('Discount amount cannot be negative.');
  }

  return { isValid: errors.length === 0, errors };
}
