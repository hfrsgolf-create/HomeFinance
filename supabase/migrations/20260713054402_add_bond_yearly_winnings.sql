-- Fix accounts type check to include 'credit'
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_type_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_type_check
  CHECK (type IN ('bank','savings','premium_bonds','pension','property','isa','credit'));

-- Per-account yearly bond winnings
CREATE TABLE IF NOT EXISTS bond_yearly_winnings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id   uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  year         int  NOT NULL CHECK (year >= 1900 AND year <= 2100),
  amount       numeric(14,2) NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, year)
);

CREATE INDEX IF NOT EXISTS bond_yearly_winnings_account_id_idx ON bond_yearly_winnings(account_id);
CREATE INDEX IF NOT EXISTS bond_yearly_winnings_year_idx        ON bond_yearly_winnings(year);

ALTER TABLE bond_yearly_winnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_bond_yearly" ON bond_yearly_winnings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_bond_yearly" ON bond_yearly_winnings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_bond_yearly" ON bond_yearly_winnings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_bond_yearly" ON bond_yearly_winnings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
