/*
# Add note column to transactions table

1. Changes
- Adds a `note` text column to the `transactions` table, defaulting to empty string.
- This allows users to attach optional free-text notes/labels to individual transactions (big spend entries).
- Existing rows get '' as the default, so no data migration is needed.

2. Security
- No changes to RLS policies. The existing owner-scoped CRUD policies on `transactions` already cover the new column.
*/

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS note text DEFAULT '';
