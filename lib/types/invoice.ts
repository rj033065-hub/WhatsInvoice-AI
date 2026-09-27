// ---------------------------------------------------------------------------
// Core domain types — kept in sync with supabase/schema.sql
// ---------------------------------------------------------------------------

export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'overdue' | 'cancelled';

// Mirrors public.invoice_items
export interface InvoiceItem {
  id?: string;
  invoice_id?: string | null;
  product_name: string;   // was `description` — now matches DB column
  quantity: number;
  unit_price: number;
  amount: number;         // was `line_total` — now matches DB column
}

// Mirrors public.invoices
export interface Invoice {
  id?: string;
  user_id?: string | null;
  business_id?: string | null;

  invoice_number: string;

  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;

  // Financial fields — names match DB columns exactly
  subtotal: number;
  discount: number;       // was `discount_amount`
  gst_rate: number;       // was `tax_rate`
  gst_amount: number;     // was `tax_amount`
  total: number;          // was `total_amount`

  status: InvoiceStatus;
  source_message?: string | null;  // was `raw_message`

  // Items are joined client-side; not a DB column
  items: InvoiceItem[];

  created_at?: string;
  updated_at?: string;

  // ----- App-only fields (not persisted to DB) ------
  // These exist only in the client/AI extraction flow
  currency?: string;        // stored in business profile, not per-invoice
  extraction_issues?: string[];
  notes?: string | null;
}

// Mirrors public.profiles
export interface Profile {
  id?: string;
  user_id: string;
  full_name?: string | null;
  email?: string | null;
  created_at?: string;
}

// Mirrors public.businesses
export interface Business {
  id?: string;
  user_id: string;
  business_name: string;
  business_type?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  logo_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Shape returned by the /api/extract route
export interface ExtractionResult {
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  currency: string;
  items: {
    product_name: string;
    quantity: number;
    unit_price: number;
  }[];
  gst_rate: number;
  discount: number;
  notes: string | null;
  issues: string[];
}
