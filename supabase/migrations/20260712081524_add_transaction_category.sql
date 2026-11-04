-- Add category column to transactions table
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS category text CHECK (category IN ('Home', 'Car', 'Holiday', 'Other'));
