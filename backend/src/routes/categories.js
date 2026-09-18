const express = require("express")
const pool = require("../db")
const requireAuth = require("../middleware/auth")
const { requireCsrf } = require("../security/csrf")
const { parseLimit, parseOffset, parsePositiveInt, validateCategoryPayload } = require("../security/validation")

const router = express.Router()
router.use(requireAuth)
router.use(requireCsrf)

router.get("/", async (req, res, next) => {
  try {
    const userId = req.user.id
    const limit = parseLimit(req.query.limit, { fallback: 100, max: 100 })
    const offset = parseOffset(req.query.offset)
    const values = [userId]
    let sql = `
      SELECT id, name, type
      FROM categories
      WHERE user_id = $1
    `

    if (!limit || offset === null) return res.status(400).json({ error: "Paginación inválida" })

    if (req.query.type) {
      if (!["income", "expense"].includes(req.query.type)) {
        return res.status(400).json({ error: "Tipo de categoría inválido" })
      }
      values.push(req.query.type)
      sql += ` AND type = $${values.length}`
    }

    values.push(limit)
    const limitIndex = values.length
    values.push(offset)
    const offsetIndex = values.length
    sql += ` ORDER BY type ASC, name ASC LIMIT $${limitIndex} OFFSET $${offsetIndex}`

    const result = await pool.query(sql, values)
    res.setHeader("X-Page-Limit", String(limit))
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
})

router.post("/", async (req, res, next) => {
  try {
    const validation = validateCategoryPayload(req.body)
    if (validation.error) return res.status(400).json({ error: validation.error })

    const { name, type } = validation.value
    const result = await pool.query(
      `
        INSERT INTO categories (user_id, name, type)
        VALUES ($1, $2, $3)
        RETURNING id, name, type
      `,
      [req.user.id, name, type]
    )

    res.status(201).json(result.rows[0])
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "La categoría ya existe" })
    next(error)
  }
})

router.patch("/:id", async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id)
    if (!id) return res.status(400).json({ error: "ID inválido" })

    const validation = validateCategoryPayload(req.body)
    if (validation.error) return res.status(400).json({ error: validation.error })
    const { name, type } = validation.value

    const current = await pool.query(
      "SELECT id, type FROM categories WHERE id = $1 AND user_id = $2",
      [id, req.user.id]
    )

    if (!current.rowCount) return res.status(404).json({ error: "Categoría no encontrada" })

    if (current.rows[0].type !== type) {
      const usage = await pool.query(
        `
          SELECT
            EXISTS(SELECT 1 FROM transactions WHERE category_id = $1 AND user_id = $2) AS has_transactions,
            EXISTS(SELECT 1 FROM budgets WHERE category_id = $1 AND user_id = $2) AS has_budgets
        `,
        [id, req.user.id]
      )

      if (usage.rows[0].has_transactions || usage.rows[0].has_budgets) {
        return res.status(409).json({
          error: "No puedes cambiar el tipo de una categoría que ya tiene movimientos o presupuestos"
        })
      }
    }

    const result = await pool.query(
      `
        UPDATE categories
        SET name = $1, type = $2
        WHERE id = $3 AND user_id = $4
        RETURNING id, name, type
      `,
      [name, type, id, req.user.id]
    )

    res.json(result.rows[0])
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "La categoría ya existe" })
    next(error)
  }
})

router.delete("/:id", async (req, res, next) => {
  try {
    const id = parsePositiveInt(req.params.id)
    if (!id) return res.status(400).json({ error: "ID inválido" })

    const usage = await pool.query(
      `
        SELECT
          EXISTS(SELECT 1 FROM transactions WHERE category_id = $1 AND user_id = $2) AS has_transactions,
          EXISTS(SELECT 1 FROM budgets WHERE category_id = $1 AND user_id = $2) AS has_budgets
      `,
      [id, req.user.id]
    )

    if (usage.rows[0].has_transactions || usage.rows[0].has_budgets) {
      return res.status(409).json({
        error: "Esta categoría está en uso. Reasigna o elimina primero sus transacciones y presupuestos."
      })
    }

    const result = await pool.query(
      "DELETE FROM categories WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, req.user.id]
    )

    if (!result.rowCount) return res.status(404).json({ error: "Categoría no encontrada" })
    res.status(204).send()
  } catch (error) {
    if (error.code === "23503") {
      return res.status(409).json({
        error: "La categoría empezó a usarse mientras intentabas eliminarla. Actualiza los datos e inténtalo de nuevo."
      })
    }
    next(error)
  }
})

module.exports = router
