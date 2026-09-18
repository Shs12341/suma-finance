-- Preserve transaction/category consistency under concurrent create/delete operations.
-- Existing uncategorized transactions remain valid because category_id is nullable.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'transactions_category_id_fkey'
      AND conrelid = 'transactions'::regclass
      AND confdeltype <> 'r'
  ) THEN
    ALTER TABLE transactions DROP CONSTRAINT transactions_category_id_fkey;
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'budgets_category_id_fkey'
      AND conrelid = 'budgets'::regclass
      AND confdeltype <> 'r'
  ) THEN
    ALTER TABLE budgets DROP CONSTRAINT budgets_category_id_fkey;
    ALTER TABLE budgets
      ADD CONSTRAINT budgets_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT;
  END IF;
END $$;
