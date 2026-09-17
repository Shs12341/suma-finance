const crypto = require("crypto")
const pool = require("./db")
const { createSessionToken, SESSION_TTL_MS } = require("./auth")

function requestMetadata(req) {
  return {
    ipAddress: String(req.ip || req.socket?.remoteAddress || "").slice(0, 64) || null,
    userAgent: String(req.get("user-agent") || "").slice(0, 500) || null
  }
}

async function createSession(user, req, queryable = pool) {
  const tokenId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  const { ipAddress, userAgent } = requestMetadata(req)

  await queryable.query(
    `
      INSERT INTO auth_sessions (token_id, user_id, expires_at, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [tokenId, user.id, expiresAt, ipAddress, userAgent]
  )

  return {
    tokenId,
    token: createSessionToken(user, tokenId),
    expiresAt
  }
}

async function revokeSession(tokenId, userId) {
  await pool.query(
    `
      UPDATE auth_sessions
      SET revoked_at = COALESCE(revoked_at, NOW())
      WHERE token_id = $1 AND user_id = $2
    `,
    [tokenId, userId]
  )
}

async function revokeAllSessions(userId) {
  const result = await pool.query(
    `
      UPDATE auth_sessions
      SET revoked_at = COALESCE(revoked_at, NOW())
      WHERE user_id = $1 AND revoked_at IS NULL
    `,
    [userId]
  )

  return result.rowCount
}

async function listSessions(userId, currentTokenId) {
  const result = await pool.query(
    `
      SELECT id, token_id, created_at, last_seen_at, expires_at, ip_address, user_agent
      FROM auth_sessions
      WHERE user_id = $1
        AND revoked_at IS NULL
        AND expires_at > NOW()
      ORDER BY last_seen_at DESC
      LIMIT 20
    `,
    [userId]
  )

  return result.rows.map(row => ({
    id: row.id,
    current: row.token_id === currentTokenId,
    created_at: row.created_at,
    last_seen_at: row.last_seen_at,
    expires_at: row.expires_at,
    ip_address: row.ip_address,
    user_agent: row.user_agent
  }))
}

module.exports = {
  createSession,
  listSessions,
  revokeAllSessions,
  revokeSession
}
