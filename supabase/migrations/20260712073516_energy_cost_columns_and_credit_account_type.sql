/*
# Energy readings: rename kWh columns to cost columns
# Accounts: add payment_due_date for credit accounts

1. Changes to `energy_readings`
   - Rename gas_kwh → gas_cost (numeric, £ cost)
   - Rename electricity_kwh → electricity_cost (numeric, £ cost)

2. Changes to `accounts`
   - Add payment_due_date (int, nullable) — day-of-month (1–31) for credit account payment due dates

3. Notes
   - No data is dropped; existing null values stay null.
   - The credit account type is enforced at the application layer via the AccountType union;
     no DB enum change is needed since the type column is already free-text.
*/

-- Rename energy cost columns
ALTER TABLE energy_readings
  RENAME COLUMN gas_kwh TO gas_cost;

ALTER TABLE energy_readings
  RENAME COLUMN electricity_kwh TO electricity_cost;

-- Add payment_due_date to accounts
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS payment_due_date int CHECK (payment_due_date >= 1 AND payment_due_date <= 31);
