-- =============================================================================
-- WhatsInvoice AI — Supabase PostgreSQL Schema
-- Run this entire file in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Safe to re-run: uses CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- HELPER: auto-update updated_at on any table that has the column
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- =============================================================================
-- TABLE: profiles
-- One row per auth.users row.  Created automatically via trigger (see bottom).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  email       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);


-- =============================================================================
-- TABLE: businesses
-- A user can have one business profile (enforced by UNIQUE user_id).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.businesses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  business_type TEXT,
  phone         TEXT,
  email         TEXT,
  gstin         TEXT,
  address       TEXT,
  city          TEXT,
  state         TEXT,
  pincode       TEXT,
  logo_url      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON public.businesses(user_id);

DROP TRIGGER IF EXISTS trg_businesses_updated_at ON public.businesses;
CREATE TRIGGER trg_businesses_updated_at
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- TABLE: invoices
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id      UUID REFERENCES public.businesses(id) ON DELETE SET NULL,

  invoice_number   TEXT NOT NULL,

  customer_name    TEXT NOT NULL,
  customer_phone   TEXT,
  customer_email   TEXT,
  customer_address TEXT,

  subtotal         NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount         NUMERIC(12, 2) NOT NULL DEFAULT 0,
  gst_rate         NUMERIC(5,  2) NOT NULL DEFAULT 0,
  gst_amount       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total            NUMERIC(12, 2) NOT NULL DEFAULT 0,

  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'pending', 'paid', 'overdue', 'cancelled')),

  source_message   TEXT,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_invoice_number_per_user UNIQUE (user_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_user_id     ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_business_id ON public.invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status      ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at  ON public.invoices(created_at DESC);

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- TABLE: invoice_items
-- No redundant user_id — ownership is enforced by RLS sub-select through invoices.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,

  product_name TEXT          NOT NULL,
  quantity     NUMERIC(10, 3) NOT NULL DEFAULT 1,
  unit_price   NUMERIC(12, 2) NOT NULL DEFAULT 0,
  amount       NUMERIC(12, 2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles: owner select"  ON public.profiles;
DROP POLICY IF EXISTS "profiles: owner insert"  ON public.profiles;
DROP POLICY IF EXISTS "profiles: owner update"  ON public.profiles;
DROP POLICY IF EXISTS "profiles: owner delete"  ON public.profiles;

CREATE POLICY "profiles: owner select"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "profiles: owner insert"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles: owner update"
  ON public.profiles FOR UPDATE
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles: owner delete"
  ON public.profiles FOR DELETE
  USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------------
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "businesses: owner select" ON public.businesses;
DROP POLICY IF EXISTS "businesses: owner insert" ON public.businesses;
DROP POLICY IF EXISTS "businesses: owner update" ON public.businesses;
DROP POLICY IF EXISTS "businesses: owner delete" ON public.businesses;

CREATE POLICY "businesses: owner select"
  ON public.businesses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "businesses: owner insert"
  ON public.businesses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "businesses: owner update"
  ON public.businesses FOR UPDATE
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "businesses: owner delete"
  ON public.businesses FOR DELETE
  USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices: owner select" ON public.invoices;
DROP POLICY IF EXISTS "invoices: owner insert" ON public.invoices;
DROP POLICY IF EXISTS "invoices: owner update" ON public.invoices;
DROP POLICY IF EXISTS "invoices: owner delete" ON public.invoices;

CREATE POLICY "invoices: owner select"
  ON public.invoices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "invoices: owner insert"
  ON public.invoices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "invoices: owner update"
  ON public.invoices FOR UPDATE
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "invoices: owner delete"
  ON public.invoices FOR DELETE
  USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- invoice_items — access only through parent invoice ownership
-- The EXISTS sub-select is O(1) via idx_invoices_user_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_items: owner select" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items: owner insert" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items: owner update" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items: owner delete" ON public.invoice_items;

CREATE POLICY "invoice_items: owner select"
  ON public.invoice_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND invoices.user_id = auth.uid()
    )
  );

CREATE POLICY "invoice_items: owner insert"
  ON public.invoice_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND invoices.user_id = auth.uid()
    )
  );

CREATE POLICY "invoice_items: owner update"
  ON public.invoice_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND invoices.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND invoices.user_id = auth.uid()
    )
  );

CREATE POLICY "invoice_items: owner delete"
  ON public.invoice_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND invoices.user_id = auth.uid()
    )
  );


-- =============================================================================
-- TRIGGER: auto-create profile row when a new auth.users row is inserted
-- SECURITY DEFINER lets this run even though it inserts into a RLS-protected table
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
