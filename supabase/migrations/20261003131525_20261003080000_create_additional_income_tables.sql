/*
# Create additional income tables

1. New Tables
- `additional_income_sources`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to auth.uid(), references auth.users)
  - `name` (text, not null) — income source name e.g. "Carl State Pension"
  - `income_type` (text, not null) — one of: state_pension, pension, investment_income, other
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

- `additional_income_entries`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to auth.uid(), references auth.users)
  - `source_id` (uuid, not null, references additional_income_sources ON DELETE CASCADE)
  - `year` (integer, not null) — the year this annual amount applies to
  - `amount` (numeric, not null, default 0) — annual amount for this year
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())
  - Unique constraint on (source_id, year) to prevent duplicate year entries

2. Security
- Enable RLS on both tables.
- Owner-scoped CRUD: each authenticated user can only access their own rows.
- 4 separate policies (select/insert/update/delete) per table, scoped to `TO authenticated` with `auth.uid() = user_id`.

3. Important Notes
- Additional Income is an income RECORD ONLY. It does NOT affect:
  - Account balances
  - Cash assets or net worth
  - Transactions
  - Bank deposits
  - Premium Bonds
  - Big Spend
  - Monthly Outgoings
- It is used only for recording recurring annual income sources and displaying them
  within the Retirement Annual Position.
- The two-table design (sources + per-year entries) allows:
  - Different annual amounts for different years on the same source
  - Deleting a single year's entry without deleting the entire source
  - Adding new year figures without overwriting previous years

4. Indexes
- Index on additional_income_entries(source_id) for fast year lookups per source.
- Index on additional_income_entries(user_id, year) for fast "all income for year X" queries.
*/

CREATE TABLE IF NOT EXISTS additional_income_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  income_type text NOT NULL DEFAULT 'other',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE additional_income_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_addl_income_sources" ON additional_income_sources;
CREATE POLICY "select_own_addl_income_sources" ON additional_income_sources FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_addl_income_sources" ON additional_income_sources;
CREATE POLICY "insert_own_addl_income_sources" ON additional_income_sources FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_addl_income_sources" ON additional_income_sources;
CREATE POLICY "update_own_addl_income_sources" ON additional_income_sources FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_addl_income_sources" ON additional_income_sources;
CREATE POLICY "delete_own_addl_income_sources" ON additional_income_sources FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS additional_income_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id uuid NOT NULL REFERENCES additional_income_sources(id) ON DELETE CASCADE,
  year integer NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE additional_income_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_addl_income_entries" ON additional_income_entries;
CREATE POLICY "select_own_addl_income_entries" ON additional_income_entries FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_addl_income_entries" ON additional_income_entries;
CREATE POLICY "insert_own_addl_income_entries" ON additional_income_entries FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_addl_income_entries" ON additional_income_entries;
CREATE POLICY "update_own_addl_income_entries" ON additional_income_entries FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_addl_income_entries" ON additional_income_entries;
CREATE POLICY "delete_own_addl_income_entries" ON additional_income_entries FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_addl_income_entries_source_id ON additional_income_entries(source_id);
CREATE INDEX IF NOT EXISTS idx_addl_income_entries_user_year ON additional_income_entries(user_id, year);
