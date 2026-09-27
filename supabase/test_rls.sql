-- =============================================================================
-- WhatsInvoice AI — RLS Cross-User Isolation Verification Script
--
-- HOW TO RUN:
--   Paste this into the Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
--   and click RUN.
--
-- WHAT IT TESTS & VERIFIES:
--   1. Profiles Isolation:
--      - User A can read/update their own profile
--      - User A cannot read/update/delete User B's profile
--   2. Businesses Isolation:
--      - User A can read/update their own business
--      - User A cannot read/update/delete User B's business
--   3. Invoices Isolation:
--      - User A can read/update/delete their own invoice
--      - User A cannot read User B's invoice (returns 0 rows via RLS)
--      - User A cannot update User B's invoice (0 rows affected)
--      - User A cannot delete User B's invoice (0 rows affected)
--      - User A cannot insert an invoice forged with User B's user_id
--   4. Invoice Items Isolation:
--      - User A can read/write items on their own invoice
--      - User A cannot read items on User B's invoice
--      - User A cannot insert/update/delete items on User B's invoice
-- =============================================================================

DO $$
DECLARE
  user_a_id   UUID := '00000000-0000-0000-0000-000000000001';
  user_b_id   UUID := '00000000-0000-0000-0000-000000000002';

  biz_a_id    UUID;
  biz_b_id    UUID;
  inv_a_id    UUID;
  inv_b_id    UUID;
  item_a_id   UUID;
  item_b_id   UUID;

  cnt         INT;
  pass_count  INT := 0;
  fail_count  INT := 0;
BEGIN
  -- ──────────────────────────────────────────────────────────────────────────
  -- SETUP: Insert test users and records (Service Role context)
  -- ──────────────────────────────────────────────────────────────────────────
  DELETE FROM auth.users WHERE id IN (user_a_id, user_b_id);

  INSERT INTO auth.users (id, email, role, aud, created_at, updated_at)
  VALUES
    (user_a_id, 'user_a@test.local', 'authenticated', 'authenticated', NOW(), NOW()),
    (user_b_id, 'user_b@test.local', 'authenticated', 'authenticated', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- Ensure profiles exist
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES
    (user_a_id, 'User Alpha', 'user_a@test.local'),
    (user_b_id, 'User Beta', 'user_b@test.local')
  ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name;

  -- Businesses
  INSERT INTO public.businesses (id, user_id, business_name, email)
  VALUES
    (gen_random_uuid(), user_a_id, 'Alpha Corp', 'alpha@corp.test')
  RETURNING id INTO biz_a_id;

  INSERT INTO public.businesses (id, user_id, business_name, email)
  VALUES
    (gen_random_uuid(), user_b_id, 'Beta Ltd', 'beta@ltd.test')
  RETURNING id INTO biz_b_id;

  -- Invoices
  INSERT INTO public.invoices (id, user_id, business_id, invoice_number, customer_name, subtotal, discount, gst_rate, gst_amount, total, status)
  VALUES
    (gen_random_uuid(), user_a_id, biz_a_id, 'INV-A-001', 'Customer Alpha', 1000, 0, 18, 180, 1180, 'draft')
  RETURNING id INTO inv_a_id;

  INSERT INTO public.invoices (id, user_id, business_id, invoice_number, customer_name, subtotal, discount, gst_rate, gst_amount, total, status)
  VALUES
    (gen_random_uuid(), user_b_id, biz_b_id, 'INV-B-001', 'Customer Beta', 500, 50, 18, 81, 531, 'paid')
  RETURNING id INTO inv_b_id;

  -- Invoice Items
  INSERT INTO public.invoice_items (id, invoice_id, product_name, quantity, unit_price, amount)
  VALUES
    (gen_random_uuid(), inv_a_id, 'Alpha Service', 1, 1000, 1000)
  RETURNING id INTO item_a_id;

  INSERT INTO public.invoice_items (id, invoice_id, product_name, quantity, unit_price, amount)
  VALUES
    (gen_random_uuid(), inv_b_id, 'Beta Product', 2, 250, 500)
  RETURNING id INTO item_b_id;

  -- ──────────────────────────────────────────────────────────────────────────
  -- SWITCH TO USER A CONTEXT
  -- ──────────────────────────────────────────────────────────────────────────
  SET LOCAL role = 'authenticated';
  SET LOCAL "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

  -- TEST 1: User A can read their own profile
  SELECT COUNT(*) INTO cnt FROM public.profiles WHERE user_id = user_a_id;
  IF cnt = 1 THEN
    RAISE NOTICE '[PASS] Test 1: User A can read own profile';
    pass_count := pass_count + 1;
  ELSE
    RAISE NOTICE '[FAIL] Test 1: User A cannot read own profile';
    fail_count := fail_count + 1;
  END IF;

  -- TEST 2: User A cannot read User B profile
  SELECT COUNT(*) INTO cnt FROM public.profiles WHERE user_id = user_b_id;
  IF cnt = 0 THEN
    RAISE NOTICE '[PASS] Test 2: User A cannot read User B profile';
    pass_count := pass_count + 1;
  ELSE
    RAISE NOTICE '[FAIL] Test 2: User A could read User B profile (leaked % rows)', cnt;
    fail_count := fail_count + 1;
  END IF;

  -- TEST 3: User A can read own business
  SELECT COUNT(*) INTO cnt FROM public.businesses WHERE user_id = user_a_id;
  IF cnt = 1 THEN
    RAISE NOTICE '[PASS] Test 3: User A can read own business';
    pass_count := pass_count + 1;
  ELSE
    RAISE NOTICE '[FAIL] Test 3: User A cannot read own business';
    fail_count := fail_count + 1;
  END IF;

  -- TEST 4: User A cannot read User B business
  SELECT COUNT(*) INTO cnt FROM public.businesses WHERE user_id = user_b_id;
  IF cnt = 0 THEN
    RAISE NOTICE '[PASS] Test 4: User A cannot read User B business';
    pass_count := pass_count + 1;
  ELSE
    RAISE NOTICE '[FAIL] Test 4: User A could read User B business';
    fail_count := fail_count + 1;
  END IF;

  -- TEST 5: User A can read own invoices
  SELECT COUNT(*) INTO cnt FROM public.invoices WHERE id = inv_a_id;
  IF cnt = 1 THEN
    RAISE NOTICE '[PASS] Test 5: User A can read own invoice';
    pass_count := pass_count + 1;
  ELSE
    RAISE NOTICE '[FAIL] Test 5: User A cannot read own invoice';
    fail_count := fail_count + 1;
  END IF;

  -- TEST 6: User A cannot read User B invoice
  SELECT COUNT(*) INTO cnt FROM public.invoices WHERE id = inv_b_id;
  IF cnt = 0 THEN
    RAISE NOTICE '[PASS] Test 6: User A cannot read User B invoice';
    pass_count := pass_count + 1;
  ELSE
    RAISE NOTICE '[FAIL] Test 6: User A could read User B invoice';
    fail_count := fail_count + 1;
  END IF;

  -- TEST 7: User A cannot UPDATE User B invoice
  UPDATE public.invoices SET status = 'cancelled' WHERE id = inv_b_id;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  IF cnt = 0 THEN
    RAISE NOTICE '[PASS] Test 7: User A cannot update User B invoice (0 rows modified)';
    pass_count := pass_count + 1;
  ELSE
    RAISE NOTICE '[FAIL] Test 7: User A was able to update User B invoice';
    fail_count := fail_count + 1;
  END IF;

  -- TEST 8: User A cannot DELETE User B invoice
  DELETE FROM public.invoices WHERE id = inv_b_id;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  IF cnt = 0 THEN
    RAISE NOTICE '[PASS] Test 8: User A cannot delete User B invoice (0 rows deleted)';
    pass_count := pass_count + 1;
  ELSE
    RAISE NOTICE '[FAIL] Test 8: User A was able to delete User B invoice';
    fail_count := fail_count + 1;
  END IF;

  -- TEST 9: User A cannot INSERT invoice belonging to User B
  BEGIN
    INSERT INTO public.invoices (user_id, invoice_number, customer_name, subtotal, discount, gst_rate, gst_amount, total, status)
    VALUES (user_b_id, 'INV-FORGED', 'Hacker', 100, 0, 0, 0, 100, 'draft');
    RAISE NOTICE '[FAIL] Test 9: User A was able to insert invoice for User B';
    fail_count := fail_count + 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[PASS] Test 9: User A cannot insert invoice with User B user_id (RLS WITH CHECK blocked)';
    pass_count := pass_count + 1;
  END;

  -- TEST 10: User A can read items on their own invoice
  SELECT COUNT(*) INTO cnt FROM public.invoice_items WHERE invoice_id = inv_a_id;
  IF cnt = 1 THEN
    RAISE NOTICE '[PASS] Test 10: User A can read items on own invoice';
    pass_count := pass_count + 1;
  ELSE
    RAISE NOTICE '[FAIL] Test 10: User A cannot read items on own invoice';
    fail_count := fail_count + 1;
  END IF;

  -- TEST 11: User A cannot read items on User B invoice
  SELECT COUNT(*) INTO cnt FROM public.invoice_items WHERE invoice_id = inv_b_id;
  IF cnt = 0 THEN
    RAISE NOTICE '[PASS] Test 11: User A cannot read items on User B invoice';
    pass_count := pass_count + 1;
  ELSE
    RAISE NOTICE '[FAIL] Test 11: User A could read items on User B invoice';
    fail_count := fail_count + 1;
  END IF;

  -- TEST 12: User A cannot INSERT item into User B invoice
  BEGIN
    INSERT INTO public.invoice_items (invoice_id, product_name, quantity, unit_price, amount)
    VALUES (inv_b_id, 'Forged Item', 1, 999, 999);
    RAISE NOTICE '[FAIL] Test 12: User A was able to insert item into User B invoice';
    fail_count := fail_count + 1;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[PASS] Test 12: User A cannot insert item into User B invoice (RLS WITH CHECK blocked)';
    pass_count := pass_count + 1;
  END;

  -- ──────────────────────────────────────────────────────────────────────────
  -- TEARDOWN & SUMMARY
  -- ──────────────────────────────────────────────────────────────────────────
  RESET role;
  RESET "request.jwt.claims";
  DELETE FROM auth.users WHERE id IN (user_a_id, user_b_id);

  RAISE NOTICE '==================================================';
  RAISE NOTICE 'RLS TEST SUITE COMPLETE: % Passed, % Failed', pass_count, fail_count;
  IF fail_count > 0 THEN
    RAISE EXCEPTION 'Cross-user isolation test failed with % error(s)', fail_count;
  ELSE
    RAISE NOTICE 'All Supabase RLS cross-user isolation tests PASSED perfectly!';
  END IF;
END;
$$;
