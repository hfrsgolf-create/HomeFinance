/*
# Add ISA account type, bond winnings, and interest tracking

1. Overview
This migration adds income tracking for two sources of passive income:
- Premium Bond winnings (monthly prize drawings)
- Bank account interest earned
These are stored SEPARATELY from account balances — they represent income
that was paid into a bank account, not a change to the bond/principal balance.
This avoids double-counting in net worth (the deposited funds are already
reflected in the bank account balance when the user updates it).

2. Schema changes
- accounts.type CHECK constraint: add 'isa' as a valid account type.
- New table `bond_winnings`:
  - id, user_id, account_id (FK to accounts, CASCADE), date, amount, note, created_at
  - One row per winnings event (date + amount). Does NOT alter account balance.
- New table `interest_records`:
  - id, user_id, account_id (FK to accounts, CASCADE), date, amount, note, created_at
  - One row per interest payment. Linked to a bank/ISA account update but stored
    separately so it can be reported as income without affecting balance logic.

3. Security
- RLS enabled on both new tables.
- Owner-scoped CRUD (TO authenticated, auth.uid() = user_id) on both tables.
- user_id columns DEFAULT auth.uid() so client inserts omitting user_id succeed.

4. Notes
- The accounts.type constraint is replaced (DROP + ADD) to include 'isa'.
  This does NOT affect existing rows — it only widens the allowed set.
- ON DELETE CASCADE on account_id ensures winnings/interest are removed
  when their parent account is deleted.
*/

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_type_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_type_check
  CHECK (type IN ('bank','savings','premium_bonds','pension','property','isa'));

CREATE TABLE IF NOT EXISTS bond_winnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(14,2) NOT NULL,
  note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bond_winnings_account ON bond_winnings(account_id);
CREATE INDEX IF NOT EXISTS idx_bond_winnings_date ON bond_winnings(date);

ALTER TABLE bond_winnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_bond_winnings" ON bond_winnings;
CREATE POLICY "select_own_bond_winnings" ON bond_winnings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_bond_winnings" ON bond_winnings;
CREATE POLICY "insert_own_bond_winnings" ON bond_winnings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_bond_winnings" ON bond_winnings;
CREATE POLICY "update_own_bond_winnings" ON bond_winnings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_bond_winnings" ON bond_winnings;
CREATE POLICY "delete_own_bond_winnings" ON bond_winnings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS interest_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(14,2) NOT NULL,
  note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interest_records_account ON interest_records(account_id);
CREATE INDEX IF NOT EXISTS idx_interest_records_date ON interest_records(date);

ALTER TABLE interest_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_interest_records" ON interest_records;
CREATE POLICY "select_own_interest_records" ON interest_records FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_interest_records" ON interest_records;
CREATE POLICY "insert_own_interest_records" ON interest_records FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_interest_records" ON interest_records;
CREATE POLICY "update_own_interest_records" ON interest_records FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_interest_records" ON interest_records;
CREATE POLICY "delete_own_interest_records" ON interest_records FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
