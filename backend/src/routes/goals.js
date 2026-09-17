const express = require("express")
const pool = require("../db")
const requireAuth = require("../middleware/auth")

const router = express.Router()
router.use(requireAuth)

function isDateOnly(value) {
  return value == null || value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function normalizeGoal(row) {
  return {
    ...row,
    target_amount: Number(row.target_amount),
    saved_amount: Number(row.saved_amount),
    target_date: row.target_date
      ? (row.target_date instanceof Date ? row.target_date.toISOString().slice(0, 10) : String(row.target_date).slice(0, 10))
      : null
  }
}

router.get("/", async (req, res, next) => {
  try {
    const result = await pool.query(
      `
        SELECT id, name, target_amount, saved_amount, target_date, created_at, updated_at
        FROM savings_goals
        WHERE user_id = $1
        ORDER BY
          CASE WHEN target_date IS NULL THEN 1 ELSE 0 END,
          target_date ASC,
          created_at DESC
      `,
      [req.user.id]
    )

    res.json(result.rows.map(normalizeGoal))
  } catch (error) {
    next(error)
  }
})

router.post("/", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim()
    const targetAmount = Number(req.body.target_amount)
    const savedAmount = req.body.saved_amount === undefined ? 0 : Number(req.body.saved_amount)
    const targetDate = req.body.target_date || null

    if (!name || name.length > 120) {
      return res.status(400).json({ error: "El nombre de la meta es obligatorio (máximo 120 caracteres)" })
    }
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      return res.status(400).json({ error: "El monto objetivo debe ser mayor que cero" })
    }
    if (!Number.isFinite(savedAmount) || savedAmount < 0) {
      return res.status(400).json({ error: "El monto ahorrado no puede ser negativo" })
    }
    if (!isDateOnly(targetDate)) {
      return res.status(400).json({ error: "Fecha objetivo inválida" })
    }

    const result = await pool.query(
      `
        INSERT INTO savings_goals (user_id, name, target_amount, saved_amount, target_date)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, target_amount, saved_amount, target_date, created_at, updated_at
      `,
      [req.user.id, name, targetAmount, savedAmount, targetDate]
    )

    res.status(201).json(normalizeGoal(result.rows[0]))
  } catch (error) {
    next(error)
  }
})

router.patch("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID inválido" })

    const currentResult = await pool.query(
      "SELECT name, target_amount, saved_amount, target_date FROM savings_goals WHERE id = $1 AND user_id = $2",
      [id, req.user.id]
    )

    if (!currentResult.rowCount) return res.status(404).json({ error: "Meta no encontrada" })

    const current = currentResult.rows[0]
    const name = String(req.body.name ?? current.name).trim()
    const targetAmount = Number(req.body.target_amount ?? current.target_amount)
    const savedAmount = Number(req.body.saved_amount ?? current.saved_amount)
    const currentTargetDate = current.target_date
      ? (current.target_date instanceof Date
          ? current.target_date.toISOString().slice(0, 10)
          : String(current.target_date).slice(0, 10))
      : null
    const targetDate = req.body.target_date === undefined
      ? currentTargetDate
      : (req.body.target_date || null)

    if (!name || name.length > 120) return res.status(400).json({ error: "Nombre de meta inválido" })
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) return res.status(400).json({ error: "Monto objetivo inválido" })
    if (!Number.isFinite(savedAmount) || savedAmount < 0) return res.status(400).json({ error: "Monto ahorrado inválido" })
    if (!isDateOnly(targetDate)) return res.status(400).json({ error: "Fecha objetivo inválida" })

    const result = await pool.query(
      `
        UPDATE savings_goals
        SET name = $1,
            target_amount = $2,
            saved_amount = $3,
            target_date = $4,
            updated_at = NOW()
        WHERE id = $5 AND user_id = $6
        RETURNING id, name, target_amount, saved_amount, target_date, created_at, updated_at
      `,
      [name, targetAmount, savedAmount, targetDate, id, req.user.id]
    )

    res.json(normalizeGoal(result.rows[0]))
  } catch (error) {
    next(error)
  }
})

router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "ID inválido" })

    const result = await pool.query(
      "DELETE FROM savings_goals WHERE id = $1 AND user_id = $2",
      [id, req.user.id]
    )

    if (!result.rowCount) return res.status(404).json({ error: "Meta no encontrada" })
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

module.exports = router
