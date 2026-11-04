/*
# Personal Finance Tracker Schema

1. Overview
This is a private, single-user retirement finance tracker. It uses Supabase
email/password auth (one user). All data is owner-scoped to the authenticated
user via user_id columns defaulting to auth.uid().

2. New Tables
- `accounts` — Financial accounts labelled by the user (no real bank data).
  Columns: id, user_id, name, type, current_value, notes, created_at, updated_at.
  type is one of: bank, savings, premium_bonds, pension, property.
- `account_updates` — Historical balance snapshots / adjustments per account.
  Columns: id, user_id, account_id, recorded_date, balance, adjustment, note, created_at.
- `transactions` — Major spending/income events (holidays, home improvements, etc.).
  Columns: id, user_id, account_id (nullable), date, description, amount, created_at.
  amount may be positive (income) or negative (spending).
- `settings` — Single row per user holding retirement projection inputs and prefs.
  Columns: id, user_id (unique), annual_spending, fire_pension_income,
  private_pension_drawdown, theme, updated_at.

3. Security
- RLS enabled on every table.
- Owner-scoped CRUD policies (TO authenticated, auth.uid() = user_id) on all tables.
- account_updates and transactions are scoped through their parent account's
  ownership as well as their own user_id.

4. Notes
- user_id columns DEFAULT auth.uid() so client inserts omitting user_id succeed.
- ON DELETE CASCADE removes child rows when an account is deleted.
- account_updates.adjustment is nullable: when a user enters a new absolute
  balance, adjustment is null; when they enter a +/- adjustment, balance stores
  the resulting computed balance and adjustment stores the delta.
*/

CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('bank','savings','premium_bonds','pension','property')),
  current_value numeric(14,2) NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_accounts" ON accounts;
CREATE POLICY "select_own_accounts" ON accounts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_accounts" ON accounts;
CREATE POLICY "insert_own_accounts" ON accounts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_accounts" ON accounts;
CREATE POLICY "update_own_accounts" ON accounts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_accounts" ON accounts;
CREATE POLICY "delete_own_accounts" ON accounts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS account_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  recorded_date date NOT NULL DEFAULT CURRENT_DATE,
  balance numeric(14,2) NOT NULL,
  adjustment numeric(14,2),
  note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_updates_account ON account_updates(account_id);
CREATE INDEX IF NOT EXISTS idx_account_updates_date ON account_updates(recorded_date);

ALTER TABLE account_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_account_updates" ON account_updates;
CREATE POLICY "select_own_account_updates" ON account_updates FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_account_updates" ON account_updates;
CREATE POLICY "insert_own_account_updates" ON account_updates FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_account_updates" ON account_updates;
CREATE POLICY "update_own_account_updates" ON account_updates FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_account_updates" ON account_updates;
CREATE POLICY "delete_own_account_updates" ON account_updates FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  amount numeric(14,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_transactions" ON transactions;
CREATE POLICY "select_own_transactions" ON transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_transactions" ON transactions;
CREATE POLICY "insert_own_transactions" ON transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_transactions" ON transactions;
CREATE POLICY "update_own_transactions" ON transactions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_transactions" ON transactions;
CREATE POLICY "delete_own_transactions" ON transactions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  annual_spending numeric(14,2) NOT NULL DEFAULT 0,
  fire_pension_income numeric(14,2) NOT NULL DEFAULT 0,
  private_pension_drawdown numeric(14,2) NOT NULL DEFAULT 0,
  theme text NOT NULL DEFAULT 'light' CHECK (theme IN ('light','dark')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_settings" ON settings;
CREATE POLICY "select_own_settings" ON settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_settings" ON settings;
CREATE POLICY "insert_own_settings" ON settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_settings" ON settings;
CREATE POLICY "update_own_settings" ON settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_settings" ON settings;
CREATE POLICY "delete_own_settings" ON settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
