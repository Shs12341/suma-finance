const express = require("express")
const pool = require("../db")
const requireAuth = require("../middleware/auth")

const router = express.Router()
router.use(requireAuth)

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function parseMonth(value) {
  const month = value || currentMonth()
  if (!/^\d{4}-\d{2}$/.test(month)) return null
  const [year, monthNumber] = month.split("-").map(Number)
  if (year < 2000 || year > 2200 || monthNumber < 1 || monthNumber > 12) return null
  return `${month}-01`
}

router.get("/", async (req, res, next) => {
  try {
    const userId = req.user.id
    const selectedMonth = parseMonth(req.query.month)
    const months = Math.min(Math.max(Number(req.query.months) || 6, 3), 12)

    if (!selectedMonth) return res.status(400).json({ error: "Mes inválido. Usa YYYY-MM" })

    const [summaryResult, historyResult, categoriesResult] = await Promise.all([
      pool.query(
        `
          SELECT
            COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) AS income,
            COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS expenses
          FROM transactions
          WHERE user_id = $1
            AND transaction_date >= $2::date
            AND transaction_date < $2::date + INTERVAL '1 month'
        `,
        [userId, selectedMonth]
      ),
      pool.query(
        `
          WITH months AS (
            SELECT generate_series(
              $2::date - (($3::int - 1) * INTERVAL '1 month'),
              $2::date,
              INTERVAL '1 month'
            )::date AS month_start
          )
          SELECT
            TO_CHAR(m.month_start, 'YYYY-MM') AS month,
            COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'income'), 0) AS income,
            COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense'), 0) AS expenses
          FROM months m
          LEFT JOIN transactions t
            ON t.user_id = $1
            AND t.transaction_date >= m.month_start
            AND t.transaction_date < m.month_start + INTERVAL '1 month'
          GROUP BY m.month_start
          ORDER BY m.month_start ASC
        `,
        [userId, selectedMonth, months]
      ),
      pool.query(
        `
          SELECT
            COALESCE(c.name, 'Uncategorized') AS category_name,
            COALESCE(SUM(t.amount), 0) AS amount
          FROM transactions t
          LEFT JOIN categories c ON c.id = t.category_id
          WHERE t.user_id = $1
            AND t.type = 'expense'
            AND t.transaction_date >= $2::date
            AND t.transaction_date < $2::date + INTERVAL '1 month'
          GROUP BY COALESCE(c.name, 'Uncategorized')
          ORDER BY amount DESC
          LIMIT 8
        `,
        [userId, selectedMonth]
      )
    ])

    const income = Number(summaryResult.rows[0].income)
    const expenses = Number(summaryResult.rows[0].expenses)
    const balance = income - expenses
    const savingsRate = income > 0 ? (balance / income) * 100 : null

    res.json({
      month: selectedMonth.slice(0, 7),
      summary: { income, expenses, balance, savings_rate: savingsRate },
      history: historyResult.rows.map(row => ({
        month: row.month,
        income: Number(row.income),
        expenses: Number(row.expenses),
        balance: Number(row.income) - Number(row.expenses)
      })),
      expense_categories: categoriesResult.rows.map(row => ({
        category_name: row.category_name,
        amount: Number(row.amount)
      }))
    })
  } catch (error) {
    next(error)
  }
})

module.exports = router
