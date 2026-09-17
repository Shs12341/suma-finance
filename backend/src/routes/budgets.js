const express = require("express")
const pool = require("../db")
const requireAuth = require("../middleware/auth")
const { requireCsrf } = require("../security/csrf")
const { isRealMonth, parsePositiveInt, validateBudgetPayload } = require("../security/validation")

const router = express.Router()
router.use(requireAuth)
router.use(requireCsrf)

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function normalizeMonth(value) {
  const month = value || currentMonth()
  return isRealMonth(month) ? `${month}-01` : null
}

function normalizeBudget(row) {
  const month = row.month instanceof Date
    ? row.month.toISOString().slice(0, 7)
    : String(row.month).slice(0, 7)

  return {
    ...row,
    month,
    amount: Number(row.amount),
    spent: Number(row.spent || 0),
    remaining: Number(row.amount) - Number(row.spent || 0)
  }
}

async function getBudget(userId, budgetId) {
  const result = await pool.query(
    `
      SELECT
        b.id,
        b.category_id,
        b.month,
        b.amount,
        c.name AS category_name,
        COALESCE(SUM(t.amount) FILTER (
          WHERE t.type = 'expense'
            AND t.transaction_date >= b.month
            AND t.transaction_date < b.month + INTERVAL '1 month'
        ), 0) AS spent
      FROM budgets b
      JOIN categories c ON c.id = b.category_id AND c.user_id = b.user_id
      LEFT JOIN transactions t
        ON t.user_id = b.user_id
        AND t.category_id = b.category_id
      WHERE b.id = $1 AND b.user_id = $2
      GROUP BY b.id, c.name
    `,
    [budgetId, userId]
  )

  return result.rowCount ? normalizeBudget(result.rows[0]) : null
}

router.get("/", async (req, res, next) => {
  try {
    const monthDate = normalizeMonth(req.query.month)
    if (!monthDate) return res.status(400).json({ error: "Mes inválido. Usa YYYY-MM" })

    const result = await pool.query(
      `
        SELECT
          b.id,
          b.category_id,
          b.month,
          b.amount,
          c.name AS category_name,
          COALESCE(SUM(t.amount) FILTER (
            WHERE t.type = 'expense'
              AND t.transaction_date >= b.month
              AND t.transaction_date < b.month + INTERVAL '1 month'
          ), 0) AS spent
        FROM budgets b
        JOIN categories c ON c.id = b.category_id AND c.user_id = b.user_id
        LEFT JOIN transactions t
          ON t.user_id = b.user_id
          AND t.category_id = b.category_id
        WHERE b.user_id = $1 AND b.month = $2::date
        GROUP BY b.id, c.name
        ORDER BY c.name ASC
        LIMIT 200
      `,
      [req.user.id, monthDate]
    )

    res.json(result.rows.map(normalizeBudget))
  } catch (error) {
    next(error)
  }
})

router.post("/", async (req, res, next) => {
  try {
    const validation = validateBudgetPayload(req.body)
    if (validation.error) return res.status(400).json({ error: validation.error })

    const { categoryId, amount, monthDate } = validation.value
    const category = await pool.query(
      "SELECT id FROM categories WHERE id = $1 AND user_id = $2 AND type = 'expense'",
      [categoryId, req.user.id]
    )

    if (!category.rowCount) {
      return res.status(400).json({ error: "El presupuesto requiere una categoría de gasto propia" })
    }

    const result = await pool.query(
      `
        INSERT INTO budgets (user_id, category_id, month, amount)
        VALUES ($1, $2, $3::date, $4)
        ON CONFLICT (user_id, category_id, month)
        DO UPDATE SET amount = EXCLUDED.amount, updated_at = NOW()
        RETURNING id
      `,
      [req.user.id, categoryId, monthDate, amount]
    )

    const budget = await getBudget(req.user.id, result.rows[0].id)
    // This endpoint behaves as an idempotent save/upsert operation.
    res.status(200).json(budget)
  } catch (error) {
    next(error)
  }
})

router.delete("/:id", async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id)
    if (!id) return res.status(400).json({ error: "ID inválido" })

    const result = await pool.query(
      "DELETE FROM budgets WHERE id = $1 AND user_id = $2",
      [id, req.user.id]
    )

    if (!result.rowCount) return res.status(404).json({ error: "Presupuesto no encontrado" })
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

module.exports = router
