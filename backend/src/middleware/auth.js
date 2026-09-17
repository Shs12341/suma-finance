const pool = require("../db")
const { COOKIE_NAME, verifySessionToken } = require("../auth")

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME]

    if (!token) {
      return res.status(401).json({ error: "Debes iniciar sesión" })
    }

    const payload = verifySessionToken(token)
    const userId = Number(payload.sub)

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ error: "Sesión inválida" })
    }

    const result = await pool.query(
      "SELECT id, name, email, created_at FROM users WHERE id = $1",
      [userId]
    )

    if (result.rowCount === 0) {
      return res.status(401).json({ error: "Sesión inválida" })
    }

    req.user = result.rows[0]
    next()
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "La sesión expiró o no es válida" })
    }

    next(error)
  }
}

module.exports = requireAuth
