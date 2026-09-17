const pool = require("./db")

async function getDemoUserId() {
  const email = process.env.DEMO_USER_EMAIL || "demo@finance.local"
  const result = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [email]
  )

  if (result.rowCount === 0) {
    const error = new Error("Usuario demo no encontrado. Ejecuta 002_seed_demo.sql")
    error.statusCode = 500
    throw error
  }

  return result.rows[0].id
}

module.exports = getDemoUserId
