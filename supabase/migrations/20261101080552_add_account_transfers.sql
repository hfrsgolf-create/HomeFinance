/*
# Add account transfers

1. New Tables
- `account_transfers`: one row per movement of the user's own money between two accounts.
  - `id`, `user_id` (defaults to the signed-in user), `from_account_id`, `to_account_id`
  - `amount` (positive, numeric(14,2)), `transfer_date`, `note`, `created_at`, `updated_at`
  - Check: amount is positive and the two accounts are different.

2. Modified Tables
- `account_updates`: new nullable `transfer_id` column linking a balance history row to the transfer that created it.
  Deleting a transfer cascades to its two history rows.

3. Security
- Enable RLS on `account_transfers`.
- Grant SELECT, INSERT, UPDATE, DELETE on `account_transfers` to `authenticated` only.
- Owner-scoped policies on `account_transfers`, and both referenced accounts must belong to the same user.

4. Notes
- Transfers are stored separately from `transactions` (Big Spend), so they never count as income or spending.
- Indexes added on `account_transfers` account columns and `account_updates.transfer_id`.
*/

CREATE TABLE IF NOT EXISTS account_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  from_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  to_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  transfer_date date NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_transfers_distinct_accounts CHECK (from_account_id <> to_account_id)
);

CREATE INDEX IF NOT EXISTS idx_account_transfers_from ON account_transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_account_transfers_to ON account_transfers(to_account_id);

ALTER TABLE account_transfers ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON account_transfers TO authenticated;

DROP POLICY IF EXISTS "select_own_account_transfers" ON account_transfers;
CREATE POLICY "select_own_account_transfers" ON account_transfers FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_account_transfers" ON account_transfers;
CREATE POLICY "insert_own_account_transfers" ON account_transfers FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM accounts a WHERE a.id = from_account_id AND a.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM accounts a WHERE a.id = to_account_id AND a.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_account_transfers" ON account_transfers;
CREATE POLICY "update_own_account_transfers" ON account_transfers FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM accounts a WHERE a.id = from_account_id AND a.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM accounts a WHERE a.id = to_account_id AND a.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_account_transfers" ON account_transfers;
CREATE POLICY "delete_own_account_transfers" ON account_transfers FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

ALTER TABLE account_updates ADD COLUMN IF NOT EXISTS transfer_id uuid REFERENCES account_transfers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_account_updates_transfer ON account_updates(transfer_id);
