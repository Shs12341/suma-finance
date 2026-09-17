const express = require("express")
const pool = require("../db")
const getDemoUserId = require("../demoUser")

const router = express.Router()


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

function isDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
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

function validatePayload(payload) {
  const type = payload.type
  const description = String(payload.description || "").trim()
  const amount = Number(payload.amount)
  const categoryId = Number(payload.category_id)
  const transactionDate = payload.transaction_date

  if (!['income', 'expense'].includes(type)) {
    return { error: "Tipo de transacción inválido" }
  }

  if (!description) {
    return { error: "La descripción es obligatoria" }
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "El monto debe ser mayor que cero" }
  }

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { error: "Selecciona una categoría válida" }
  }

  if (!isDateOnly(transactionDate)) {
    return { error: "La fecha debe tener formato YYYY-MM-DD" }
  }

  return {
    value: {
      type,
      description,
      amount,
      categoryId,
      transactionDate
    }
  }
}

router.get("/", async (req, res) => {
  try {
    const userId = await getDemoUserId()
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
        LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.user_id = $1
        ORDER BY t.transaction_date DESC, t.id DESC
      `,
      [userId]
    )

    res.json(result.rows.map(normalizeTransaction))
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error al obtener transacciones" })
  }
})

router.post("/", async (req, res) => {
  try {
    const userId = await getDemoUserId()
    const validation = validatePayload(req.body)

    if (validation.error) {
      return res.status(400).json({ error: validation.error })
    }

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
      "SELECT name FROM categories WHERE id = $1",
      [transaction.category_id]
    )

    res.status(201).json(
      normalizeTransaction({
        ...transaction,
        category_name: category.rows[0]?.name || null
      })
    )
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error al crear transacción" })
  }
})

router.patch("/:id", async (req, res) => {
  try {
    const userId = await getDemoUserId()
    const id = Number(req.params.id)

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "ID inválido" })
    }

    const currentResult = await pool.query(
      `
        SELECT type, description, amount, transaction_date, category_id
        FROM transactions
        WHERE id = $1 AND user_id = $2
      `,
      [id, userId]
    )

    if (currentResult.rowCount === 0) {
      return res.status(404).json({ error: "Transacción no encontrada" })
    }

    const current = currentResult.rows[0]
    const merged = {
      type: req.body.type ?? current.type,
      description: req.body.description ?? current.description,
      amount: req.body.amount ?? current.amount,
      category_id: req.body.category_id ?? current.category_id,
      transaction_date: req.body.transaction_date ?? normalizeTransaction(current).transaction_date
    }

    const validation = validatePayload(merged)

    if (validation.error) {
      return res.status(400).json({ error: validation.error })
    }

    const { type, description, amount, categoryId, transactionDate } = validation.value

    if (!(await validateCategory(categoryId, type, userId))) {
      return res.status(400).json({ error: "La categoría no corresponde al tipo de transacción" })
    }

    const result = await pool.query(
      `
        UPDATE transactions
        SET
          category_id = $1,
          type = $2,
          description = $3,
          amount = $4,
          transaction_date = $5
        WHERE id = $6 AND user_id = $7
        RETURNING id, type, description, amount, transaction_date, category_id
      `,
      [categoryId, type, description, amount, transactionDate, id, userId]
    )

    const transaction = result.rows[0]
    const category = await pool.query(
      "SELECT name FROM categories WHERE id = $1",
      [transaction.category_id]
    )

    res.json(
      normalizeTransaction({
        ...transaction,
        category_name: category.rows[0]?.name || null
      })
    )
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error al actualizar transacción" })
  }
})

router.delete("/:id", async (req, res) => {
  try {
    const userId = await getDemoUserId()
    const id = Number(req.params.id)

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "ID inválido" })
    }

    const result = await pool.query(
      "DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, userId]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Transacción no encontrada" })
    }

    res.status(204).send()
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error al eliminar transacción" })
  }
})

module.exports = router
