const express = require("express")
const pool = require("../db")
const requireAuth = require("../middleware/auth")

const router = express.Router()

router.use(requireAuth)

router.get("/", async (req, res, next) => {
  try {
    const userId = req.user.id
    const values = [userId]
    let sql = `
      SELECT id, name, type
      FROM categories
      WHERE user_id = $1
    `

    if (req.query.type) {
      if (!["income", "expense"].includes(req.query.type)) {
        return res.status(400).json({ error: "Tipo de categoría inválido" })
      }

      values.push(req.query.type)
      sql += " AND type = $2"
    }

    sql += " ORDER BY type ASC, name ASC"

    const result = await pool.query(sql, values)
    res.json(result.rows)
  } catch (error) {
    next(error)
  }
})

router.post("/", async (req, res, next) => {
  try {
    const userId = req.user.id
    const name = String(req.body.name || "").trim()
    const type = req.body.type

    if (!name || !["income", "expense"].includes(type)) {
      return res.status(400).json({ error: "Nombre y tipo válidos son obligatorios" })
    }

    const result = await pool.query(
      `
        INSERT INTO categories (user_id, name, type)
        VALUES ($1, $2, $3)
        RETURNING id, name, type
      `,
      [userId, name, type]
    )

    res.status(201).json(result.rows[0])
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "La categoría ya existe" })
    }

    next(error)
  }
})

router.patch("/:id", async (req, res, next) => {
  try {
    const userId = req.user.id
    const id = Number(req.params.id)
    const name = String(req.body.name || "").trim()
    const type = req.body.type

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "ID inválido" })
    }

    if (!name || !["income", "expense"].includes(type)) {
      return res.status(400).json({ error: "Nombre y tipo válidos son obligatorios" })
    }

    const current = await pool.query(
      "SELECT id, type FROM categories WHERE id = $1 AND user_id = $2",
      [id, userId]
    )

    if (!current.rowCount) {
      return res.status(404).json({ error: "Categoría no encontrada" })
    }

    if (current.rows[0].type !== type) {
      const usage = await pool.query(
        `
          SELECT
            EXISTS(SELECT 1 FROM transactions WHERE category_id = $1 AND user_id = $2) AS has_transactions,
            EXISTS(SELECT 1 FROM budgets WHERE category_id = $1 AND user_id = $2) AS has_budgets
        `,
        [id, userId]
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
      [name, type, id, userId]
    )

    res.json(result.rows[0])
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "La categoría ya existe" })
    }

    next(error)
  }
})

router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "ID inválido" })
    }

    const result = await pool.query(
      "DELETE FROM categories WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, req.user.id]
    )

    if (!result.rowCount) {
      return res.status(404).json({ error: "Categoría no encontrada" })
    }

    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

module.exports = router
