/*
# Add outgoings, historical data, and account reordering

1. Overview
This migration adds three features:
- Recurring monthly outgoings tracking (mortgage, utilities, council tax, etc.)
- Historical yearly data (fire pension, bond winnings totals, year-start balances)
- Account reordering via a sort_order column on accounts

2. New Tables
- `outgoings`:
  - id, user_id, name, amount (monthly), type (direct_debit/standing_order/other),
    notes, sort_order, created_at
  - One row per recurring outgoing.
- `historical_data`:
  - id, user_id, year (int), fire_pension, bond_winnings, year_start_balance,
    created_at, updated_at
  - One row per year. Stores manually-entered yearly totals for projection use.
  - UNIQUE on (user_id, year) to prevent duplicates.

3. Modified Tables
- `accounts`: add `sort_order integer NOT NULL DEFAULT 0` column for custom ordering.

4. Security
- RLS enabled on both new tables.
- Owner-scoped CRUD (TO authenticated, auth.uid() = user_id) on both tables.
- user_id columns DEFAULT auth.uid().

5. Notes
- The sort_order column on accounts allows drag-and-drop / move up-down reordering.
- outgoings.type uses a CHECK constraint: direct_debit, standing_order, other.
- historical_data uses a UNIQUE constraint on (user_id, year) so upserts work.
*/

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS outgoings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'other' CHECK (type IN ('direct_debit','standing_order','other')),
  notes text DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE outgoings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_outgoings" ON outgoings;
CREATE POLICY "select_own_outgoings" ON outgoings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_outgoings" ON outgoings;
CREATE POLICY "insert_own_outgoings" ON outgoings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_outgoings" ON outgoings;
CREATE POLICY "update_own_outgoings" ON outgoings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_outgoings" ON outgoings;
CREATE POLICY "delete_own_outgoings" ON outgoings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS historical_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  year integer NOT NULL,
  fire_pension numeric(14,2) NOT NULL DEFAULT 0,
  bond_winnings numeric(14,2) NOT NULL DEFAULT 0,
  year_start_balance numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, year)
);

ALTER TABLE historical_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_historical_data" ON historical_data;
CREATE POLICY "select_own_historical_data" ON historical_data FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_historical_data" ON historical_data;
CREATE POLICY "insert_own_historical_data" ON historical_data FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_historical_data" ON historical_data;
CREATE POLICY "update_own_historical_data" ON historical_data FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_historical_data" ON historical_data;
CREATE POLICY "delete_own_historical_data" ON historical_data FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
