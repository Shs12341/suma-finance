const express = require("express")
const pool = require("../db")
const requireAuth = require("../middleware/auth")
const { requireCsrf } = require("../security/csrf")
const { hasOnlyKeys, parseLimit, parseOffset, parsePositiveInt, validateGoalPayload } = require("../security/validation")

const router = express.Router()
router.use(requireAuth)
router.use(requireCsrf)

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
    const limit = parseLimit(req.query.limit, { fallback: 50, max: 100 })
    const offset = parseOffset(req.query.offset)
    if (!limit || offset === null) return res.status(400).json({ error: "Paginación inválida" })

    const result = await pool.query(
      `
        SELECT id, name, target_amount, saved_amount, target_date, created_at, updated_at
        FROM savings_goals
        WHERE user_id = $1
        ORDER BY CASE WHEN target_date IS NULL THEN 1 ELSE 0 END, target_date ASC, created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [req.user.id, limit, offset]
    )

    res.setHeader("X-Page-Limit", String(limit))
    res.json(result.rows.map(normalizeGoal))
  } catch (error) {
    next(error)
  }
})

router.post("/", async (req, res, next) => {
  try {
    const validation = validateGoalPayload(req.body)
    if (validation.error) return res.status(400).json({ error: validation.error })

    const { name, targetAmount, savedAmount, targetDate } = validation.value
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
    const id = parsePositiveInt(req.params.id)
    if (!id) return res.status(400).json({ error: "ID inválido" })

    if (!hasOnlyKeys(req.body, ["name", "target_amount", "saved_amount", "target_date"])) {
      return res.status(400).json({ error: "La meta contiene campos no permitidos" })
    }

    const currentResult = await pool.query(
      "SELECT name, target_amount, saved_amount, target_date FROM savings_goals WHERE id = $1 AND user_id = $2",
      [id, req.user.id]
    )

    if (!currentResult.rowCount) return res.status(404).json({ error: "Meta no encontrada" })

    const current = normalizeGoal(currentResult.rows[0])
    const merged = {
      name: req.body.name ?? current.name,
      target_amount: req.body.target_amount ?? current.target_amount,
      saved_amount: req.body.saved_amount ?? current.saved_amount,
      target_date: req.body.target_date === undefined ? current.target_date : req.body.target_date
    }

    const validation = validateGoalPayload(merged)
    if (validation.error) return res.status(400).json({ error: validation.error })

    const { name, targetAmount, savedAmount, targetDate } = validation.value
    const result = await pool.query(
      `
        UPDATE savings_goals
        SET name = $1, target_amount = $2, saved_amount = $3, target_date = $4, updated_at = NOW()
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
    const id = parsePositiveInt(req.params.id)
    if (!id) return res.status(400).json({ error: "ID inválido" })

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
