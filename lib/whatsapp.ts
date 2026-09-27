import { Invoice } from './types/invoice';

export interface WhatsAppMessageOptions {
  invoice: Invoice;
  businessName?: string;
}

/**
 * Cleans phone number to format acceptable by WhatsApp wa.me.
 * Strips all non-digit characters (+, spaces, hyphens, parentheses).
 */
export function cleanWhatsAppPhone(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';

  // If 10 digits (standard Indian mobile number without country code), prepend 91
  if (digits.length === 10) {
    return `91${digits}`;
  }

  return digits;
}

/**
 * Builds a concise, professional WhatsApp message text for the invoice.
 *
 * Rules:
 * - Includes: business name, invoice number, customer name, total, short instruction to view/print
 * - Does NOT claim to send a PDF automatically
 * - Does NOT create insecure public URLs
 * - Keeps invoice data private
 */
export function formatWhatsAppInvoiceMessage(options: WhatsAppMessageOptions): string {
  const { invoice, businessName = 'Our Business' } = options;
  const currency = invoice.currency || '₹';

  const lines = [
    `*Invoice from ${businessName}*`,
    `Invoice No: ${invoice.invoice_number}`,
    `Customer: ${invoice.customer_name}`,
    `Total: ${currency} ${invoice.total.toFixed(2)}`,
    ``,
    `Please contact us if you need a printed copy or tax invoice breakdown.`,
    `Thank you for your business!`,
  ];

  return lines.join('\n');
}

/**
 * Generates the wa.me WhatsApp share URL.
 *
 * Pattern:
 * - If phone exists: https://wa.me/<phone>?text=<encoded-message>
 * - If no phone exists: https://wa.me/?text=<encoded-message>
 */
export function generateWhatsAppShareUrl(options: WhatsAppMessageOptions): string {
  const { invoice } = options;
  const messageText = formatWhatsAppInvoiceMessage(options);
  const encodedText = encodeURIComponent(messageText);

  const cleanPhone = cleanWhatsAppPhone(invoice.customer_phone);

  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }

  return `https://wa.me/?text=${encodedText}`;
}
