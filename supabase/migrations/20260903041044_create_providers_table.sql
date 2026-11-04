/*
# Create providers table

1. New Tables
- `providers`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to auth.uid(), references auth.users)
  - `name` (text, not null) — provider name e.g. "Sky TV"
  - `category` (text, not null) — one of: tv_streaming, utilities, insurance, home, vehicle, broadband_phone, subscriptions, other
  - `amount` (numeric, not null, default 0) — payment amount
  - `frequency` (text, not null, default 'monthly') — 'monthly' or 'annually'
  - `contract_start_date` (date, nullable) — optional contract start
  - `renewal_date` (date, nullable) — contract expiry / renewal date
  - `notes` (text, nullable) — optional notes
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

2. Security
- Enable RLS on `providers`.
- Owner-scoped CRUD: each authenticated user can only access their own provider rows.
- 4 separate policies (select/insert/update/delete), scoped to `TO authenticated` with `auth.uid() = user_id`.

3. Important Notes
- This table is completely independent from all financial tables (accounts, transactions, outgoings, etc.).
- Provider data does NOT affect any financial calculations (net worth, cash assets, outgoings, etc.).
- The structure supports future features: renewal reminders, contract price history, previous renewal dates, and cost comparisons over time.
*/

CREATE TABLE IF NOT EXISTS providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  amount numeric NOT NULL DEFAULT 0,
  frequency text NOT NULL DEFAULT 'monthly',
  contract_start_date date,
  renewal_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_providers" ON providers;
CREATE POLICY "select_own_providers" ON providers FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_providers" ON providers;
CREATE POLICY "insert_own_providers" ON providers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_providers" ON providers;
CREATE POLICY "update_own_providers" ON providers FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_providers" ON providers;
CREATE POLICY "delete_own_providers" ON providers FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
