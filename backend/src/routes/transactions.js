const express = require("express")
const pool = require("../db")
const requireAuth = require("../middleware/auth")
const { requireCsrf } = require("../security/csrf")
const { decodeCursor, encodeCursor } = require("../security/pagination")
const {
  cleanString,
  isRealMonth,
  hasOnlyKeys,
  parseLimit,
  parsePositiveInt,
  validateTransactionPayload
} = require("../security/validation")

const router = express.Router()
router.use(requireAuth)
router.use(requireCsrf)

function normalizeTransaction(row) {
  const rawDate = row.transaction_date
  const transactionDate = rawDate instanceof Date
    ? rawDate.toISOString().slice(0, 10)
    : String(rawDate).slice(0, 10)

  return {
    ...row,
    amount: Number(row.amount),
    transaction_date: transactionDate
  }
}

async function validateCategory(categoryId, type, userId) {
  const result = await pool.query(
    `
      SELECT id
      FROM categories
      WHERE id = $1 AND user_id = $2 AND type = $3
    `,
    [categoryId, userId, type]
  )

  return result.rowCount > 0
}

router.get("/", async (req, res, next) => {
  try {
    const userId = req.user.id
    const limit = parseLimit(req.query.limit, { fallback: 30, max: 100 })
    const cursor = req.query.cursor ? decodeCursor(req.query.cursor) : null
    const type = req.query.type || "all"
    const month = req.query.month || "all"
    const search = cleanString(req.query.search).slice(0, 100)

    if (!limit) return res.status(400).json({ error: "Límite inválido" })
    if (req.query.cursor && !cursor) return res.status(400).json({ error: "Cursor inválido" })
    if (!["all", "income", "expense"].includes(type)) return res.status(400).json({ error: "Filtro de tipo inválido" })
    if (month !== "all" && !isRealMonth(month)) return res.status(400).json({ error: "Filtro de mes inválido" })

    const values = [userId]
    const conditions = ["t.user_id = $1"]

    if (type !== "all") {
      values.push(type)
      conditions.push(`t.type = $${values.length}`)
    }

    if (month !== "all") {
      values.push(`${month}-01`)
      const index = values.length
      conditions.push(`t.transaction_date >= $${index}::date AND t.transaction_date < $${index}::date + INTERVAL '1 month'`)
    }

    if (search) {
      values.push(`%${search}%`)
      const index = values.length
      conditions.push(`(t.description ILIKE $${index} OR COALESCE(c.name, '') ILIKE $${index})`)
    }

    if (cursor) {
      values.push(cursor.date)
      const dateIndex = values.length
      values.push(cursor.id)
      const idIndex = values.length
      conditions.push(`(t.transaction_date, t.id) < ($${dateIndex}::date, $${idIndex}::int)`)
    }

    values.push(limit + 1)
    const limitIndex = values.length

    const result = await pool.query(
      `
        SELECT
          t.id,
          t.type,
          t.description,
          t.amount,
          t.transaction_date,
          t.category_id,
          c.name AS category_name
        FROM transactions t
        LEFT JOIN categories c ON c.id = t.category_id AND c.user_id = t.user_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY t.transaction_date DESC, t.id DESC
        LIMIT $${limitIndex}
      `,
      values
    )

    const hasMore = result.rows.length > limit
    const items = result.rows.slice(0, limit).map(normalizeTransaction)
    const last = items[items.length - 1]

    res.json({
      items,
      next_cursor: hasMore && last
        ? encodeCursor({ date: last.transaction_date, id: last.id })
        : null
    })
  } catch (error) {
    next(error)
  }
})

router.post("/", async (req, res, next) => {
  try {
    const userId = req.user.id
    const validation = validateTransactionPayload(req.body)

    if (validation.error) return res.status(400).json({ error: validation.error })

    const { type, description, amount, categoryId, transactionDate } = validation.value

    if (!(await validateCategory(categoryId, type, userId))) {
      return res.status(400).json({ error: "La categoría no corresponde al tipo de transacción" })
    }

    const result = await pool.query(
      `
        INSERT INTO transactions
          (user_id, category_id, type, description, amount, transaction_date)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, type, description, amount, transaction_date, category_id
      `,
      [userId, categoryId, type, description, amount, transactionDate]
    )

    const transaction = result.rows[0]
    const category = await pool.query(
      "SELECT name FROM categories WHERE id = $1 AND user_id = $2",
      [transaction.category_id, userId]
    )

    res.status(201).json(normalizeTransaction({
      ...transaction,
      category_name: category.rows[0]?.name || null
    }))
  } catch (error) {
    next(error)
  }
})

router.patch("/:id", async (req, res, next) => {
  try {
    const userId = req.user.id
    const id = parsePositiveInt(req.params.id)
    if (!id) return res.status(400).json({ error: "ID inválido" })

    if (!hasOnlyKeys(req.body, ["type", "description", "amount", "category_id", "transaction_date"])) {
      return res.status(400).json({ error: "La transacción contiene campos no permitidos" })
    }

    const currentResult = await pool.query(
      `
        SELECT type, description, amount, transaction_date, category_id
        FROM transactions
        WHERE id = $1 AND user_id = $2
      `,
      [id, userId]
    )

    if (currentResult.rowCount === 0) return res.status(404).json({ error: "Transacción no encontrada" })

    const current = normalizeTransaction(currentResult.rows[0])
    const merged = {
      type: req.body.type ?? current.type,
      description: req.body.description ?? current.description,
      amount: req.body.amount ?? current.amount,
      category_id: req.body.category_id ?? current.category_id,
      transaction_date: req.body.transaction_date ?? current.transaction_date
    }

    const validation = validateTransactionPayload(merged)
    if (validation.error) return res.status(400).json({ error: validation.error })

    const { type, description, amount, categoryId, transactionDate } = validation.value

    if (!(await validateCategory(categoryId, type, userId))) {
      return res.status(400).json({ error: "La categoría no corresponde al tipo de transacción" })
    }

    const result = await pool.query(
      `
        UPDATE transactions
        SET category_id = $1, type = $2, description = $3, amount = $4, transaction_date = $5
        WHERE id = $6 AND user_id = $7
        RETURNING id, type, description, amount, transaction_date, category_id
      `,
      [categoryId, type, description, amount, transactionDate, id, userId]
    )

    const transaction = result.rows[0]
    const category = await pool.query(
      "SELECT name FROM categories WHERE id = $1 AND user_id = $2",
      [transaction.category_id, userId]
    )

    res.json(normalizeTransaction({
      ...transaction,
      category_name: category.rows[0]?.name || null
    }))
  } catch (error) {
    next(error)
  }
})

router.delete("/:id", async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id)
    if (!id) return res.status(400).json({ error: "ID inválido" })

    const result = await pool.query(
      "DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, req.user.id]
    )

    if (result.rowCount === 0) return res.status(404).json({ error: "Transacción no encontrada" })
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

module.exports = router
