INSERT INTO users (name, email, password_hash)
VALUES ('Diego', 'demo@finance.local', 'not-used-until-auth-is-added')
ON CONFLICT (email) DO NOTHING;

INSERT INTO categories (user_id, name, type)
SELECT u.id, seed.name, seed.type
FROM users u
CROSS JOIN (
    VALUES
      ('Salary', 'income'),
      ('Freelance', 'income'),
      ('Other income', 'income'),
      ('Food', 'expense'),
      ('Transport', 'expense'),
      ('Bills', 'expense'),
      ('Education', 'expense'),
      ('Entertainment', 'expense'),
      ('Other expense', 'expense')
) AS seed(name, type)
WHERE u.email = 'demo@finance.local'
ON CONFLICT (user_id, name, type) DO NOTHING;

WITH demo_user AS (
  SELECT id FROM users WHERE email = 'demo@finance.local'
), sample_rows(type, description, amount, category_name, days_ago) AS (
  VALUES
    ('income', 'Main income', 1800.00, 'Salary', 2),
    ('expense', 'Supermarket', 30.00, 'Food', 1),
    ('expense', 'Gasoline', 20.00, 'Transport', 1),
    ('expense', 'Internet', 40.00, 'Bills', 0)
)
INSERT INTO transactions
  (user_id, category_id, type, description, amount, transaction_date)
SELECT
  u.id,
  c.id,
  s.type,
  s.description,
  s.amount,
  CURRENT_DATE - s.days_ago
FROM demo_user u
CROSS JOIN sample_rows s
JOIN categories c
  ON c.user_id = u.id
 AND c.name = s.category_name
 AND c.type = s.type
WHERE NOT EXISTS (
  SELECT 1 FROM transactions t WHERE t.user_id = u.id
);
