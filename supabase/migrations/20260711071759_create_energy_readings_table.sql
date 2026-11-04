/*
# Create energy_readings table

1. New Tables
- `energy_readings` — Monthly gas and electricity usage readings.
  Columns: id, user_id, month (int 1-12), year (int), gas_kwh (numeric),
  electricity_kwh (numeric), notes, created_at, updated_at.
  Unique constraint on (user_id, month, year) to prevent duplicate entries.

2. Security
- RLS enabled on energy_readings.
- Owner-scoped CRUD policies (TO authenticated, auth.uid() = user_id).

3. Notes
- user_id defaults to auth.uid() so client inserts omitting user_id succeed.
- gas_kwh and electricity_kwh are nullable (some months may have only one type).
*/

CREATE TABLE IF NOT EXISTS energy_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  month int NOT NULL CHECK (month >= 1 AND month <= 12),
  year int NOT NULL,
  gas_kwh numeric,
  electricity_kwh numeric,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_month_year UNIQUE (user_id, month, year)
);

ALTER TABLE energy_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_energy_readings" ON energy_readings;
CREATE POLICY "select_own_energy_readings" ON energy_readings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_energy_readings" ON energy_readings;
CREATE POLICY "insert_own_energy_readings" ON energy_readings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_energy_readings" ON energy_readings;
CREATE POLICY "update_own_energy_readings" ON energy_readings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_energy_readings" ON energy_readings;
CREATE POLICY "delete_own_energy_readings" ON energy_readings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
