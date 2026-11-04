/*
# Add Estimated Tax Liability column to accounts

1. New Columns
- `accounts.estimated_tax_liability` (numeric, default 0)
  - Stores a user-entered estimate of tax owed on a pension account.
  - Display only — does NOT affect account balances or transactions.

2. Notes
- The column is nullable-safe with a default of 0 so existing rows are unaffected.
- No RLS changes needed — existing account policies already cover the new column.
*/

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS estimated_tax_liability numeric NOT NULL DEFAULT 0;
