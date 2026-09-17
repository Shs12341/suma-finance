const express = require("express")
const pool = require("../db")
const getDemoUserId = require("../demoUser")

const router = express.Router()


router.get("/", async (req, res) => {
  try {
    const userId = await getDemoUserId()
    const values = [userId]
    let sql = `
      SELECT id, name, type
      FROM categories
      WHERE user_id = $1
    `

    if (req.query.type) {
      if (!['income', 'expense'].includes(req.query.type)) {
        return res.status(400).json({ error: "Tipo de categoría inválido" })
      }

      values.push(req.query.type)
      sql += ` AND type = $2`
    }

    sql += ` ORDER BY type ASC, name ASC`

    const result = await pool.query(sql, values)
    res.json(result.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Error al obtener categorías" })
  }
})

router.post("/", async (req, res) => {
  try {
    const userId = await getDemoUserId()
    const name = String(req.body.name || "").trim()
    const type = req.body.type

    if (!name || !['income', 'expense'].includes(type)) {
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

    console.error(error)
    res.status(500).json({ error: "Error al crear categoría" })
  }
})

module.exports = router
