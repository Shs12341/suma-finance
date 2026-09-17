const pool = require("../db")
const { COOKIE_NAME, verifySessionToken, clearCookieOptions } = require("../auth")

function rejectSession(res, message) {
  res.clearCookie(COOKIE_NAME, clearCookieOptions())
  return res.status(401).json({ error: message })
}

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME]

    if (!token) {
      return res.status(401).json({ error: "Debes iniciar sesión" })
    }

    const payload = verifySessionToken(token)
    const userId = Number(payload.sub)
    const tokenId = payload.jti

    if (!Number.isInteger(userId) || userId <= 0 || typeof tokenId !== "string" || !tokenId) {
      return rejectSession(res, "Sesión inválida")
    }

    const result = await pool.query(
      `
        SELECT
          u.id,
          u.name,
          u.email,
          u.created_at,
          s.id AS session_id,
          s.token_id,
          s.expires_at
        FROM auth_sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token_id = $1
          AND s.user_id = $2
          AND s.revoked_at IS NULL
          AND s.expires_at > NOW()
      `,
      [tokenId, userId]
    )

    if (result.rowCount === 0) {
      return rejectSession(res, "Sesión expirada, cerrada o inválida")
    }

    const row = result.rows[0]
    req.user = {
      id: row.id,
      name: row.name,
      email: row.email,
      created_at: row.created_at
    }
    req.auth = {
      sessionId: row.session_id,
      tokenId: row.token_id,
      expiresAt: row.expires_at
    }

    // Avoid a write on every request while keeping useful session activity metadata.
    pool.query(
      `
        UPDATE auth_sessions
        SET last_seen_at = NOW()
        WHERE token_id = $1
          AND last_seen_at < NOW() - INTERVAL '5 minutes'
      `,
      [tokenId]
    ).catch(error => console.error("No se pudo actualizar last_seen_at", error.message))

    next()
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return rejectSession(res, "La sesión expiró o no es válida")
    }

    next(error)
  }
}

module.exports = requireAuth
