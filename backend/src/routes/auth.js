const express = require("express")
const bcrypt = require("bcryptjs")
const pool = require("../db")
const requireAuth = require("../middleware/auth")
const defaultCategories = require("../defaultCategories")
const { COOKIE_NAME, cookieOptions, clearCookieOptions } = require("../auth")
const { createCsrfToken, requireCsrf } = require("../security/csrf")
const { authIpLimiter, loginCredentialLimiter, registerIpLimiter } = require("../security/rateLimit")
const { validateAuthPayload, parsePositiveInt } = require("../security/validation")
const { createSession, listSessions, revokeAllSessions, revokeSession } = require("../session")
const { securityEvent, securityWarning } = require("../security/logger")

const DUMMY_PASSWORD_HASH = bcrypt.hashSync("finance-app-dummy-password", 12)

const router = express.Router()

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    created_at: user.created_at
  }
}

router.post("/register", authIpLimiter, registerIpLimiter, async (req, res, next) => {
  const validation = validateAuthPayload(req.body, true)

  if (validation.error) {
    return res.status(400).json({ error: validation.error })
  }

  const { name, email, password } = validation.value
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const passwordHash = await bcrypt.hash(password, 12)
    const userResult = await client.query(
      `
        INSERT INTO users (name, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, name, email, created_at
      `,
      [name, email, passwordHash]
    )

    const user = userResult.rows[0]

    for (const category of defaultCategories) {
      await client.query(
        `
          INSERT INTO categories (user_id, name, type)
          VALUES ($1, $2, $3)
        `,
        [user.id, category.name, category.type]
      )
    }

    const session = await createSession(user, req, client)
    await client.query("COMMIT")

    res.cookie(COOKIE_NAME, session.token, cookieOptions())
    securityEvent("auth_register_success", req, { status: 201, outcome: "success" })
    res.status(201).json({ user: publicUser(user) })
  } catch (error) {
    await client.query("ROLLBACK")

    if (error.code === "23505") {
      securityWarning("auth_register_conflict", req, { status: 409, outcome: "denied" })
      return res.status(409).json({ error: "No se pudo crear la cuenta con esos datos" })
    }

    next(error)
  } finally {
    client.release()
  }
})

router.post("/login", authIpLimiter, loginCredentialLimiter, async (req, res, next) => {
  const validation = validateAuthPayload(req.body, false)

  if (validation.error) {
    return res.status(400).json({ error: validation.error })
  }

  const { email, password } = validation.value

  try {
    const result = await pool.query(
      `
        SELECT id, name, email, password_hash, created_at
        FROM users
        WHERE email = $1
      `,
      [email]
    )

    const user = result.rows[0] || null
    const candidateHash = user && /^\$2[aby]\$/.test(user.password_hash)
      ? user.password_hash
      : DUMMY_PASSWORD_HASH
    const passwordMatches = await bcrypt.compare(password, candidateHash)

    if (!user || !passwordMatches) {
      securityWarning("auth_login_failed", req, { status: 401, outcome: "denied" })
      return res.status(401).json({ error: "Correo o contraseña incorrectos" })
    }

    const session = await createSession(user, req)
    res.cookie(COOKIE_NAME, session.token, cookieOptions())
    securityEvent("auth_login_success", req, { status: 200, outcome: "success" })
    res.json({ user: publicUser(user) })
  } catch (error) {
    next(error)
  }
})

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) })
})

router.get("/csrf", requireAuth, (req, res) => {
  res.json({ csrf_token: createCsrfToken(req.auth.tokenId) })
})

router.get("/sessions", requireAuth, async (req, res, next) => {
  try {
    res.json({ sessions: await listSessions(req.user.id, req.auth.tokenId) })
  } catch (error) {
    next(error)
  }
})

router.post("/logout", requireAuth, requireCsrf, async (req, res, next) => {
  try {
    await revokeSession(req.auth.tokenId, req.user.id)
    securityEvent("auth_logout", req, { status: 204, outcome: "success", session_id: req.auth.sessionId })
    res.clearCookie(COOKIE_NAME, clearCookieOptions())
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

router.post("/logout-all", requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const revoked = await revokeAllSessions(req.user.id)
    securityEvent("auth_logout_all", req, { status: 200, outcome: "success", revoked_count: revoked })
    res.clearCookie(COOKIE_NAME, clearCookieOptions())
    res.json({ revoked_sessions: revoked })
  } catch (error) {
    next(error)
  }
})

router.delete("/sessions/:id", requireAuth, requireCsrf, async (req, res, next) => {
  try {
    const sessionId = parsePositiveInt(req.params.id)
    if (!sessionId) return res.status(400).json({ error: "ID de sesión inválido" })

    const result = await pool.query(
      `
        UPDATE auth_sessions
        SET revoked_at = COALESCE(revoked_at, NOW())
        WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
        RETURNING token_id
      `,
      [sessionId, req.user.id]
    )

    if (!result.rowCount) return res.status(404).json({ error: "Sesión no encontrada" })

    const revokedCurrentSession = result.rows[0].token_id === req.auth.tokenId
    securityEvent("auth_session_revoked", req, {
      status: 200,
      outcome: "success",
      resource: "session",
      resource_id: sessionId
    })
    if (revokedCurrentSession) {
      res.clearCookie(COOKIE_NAME, clearCookieOptions())
    }

    res.json({ revoked: true, current_session: revokedCurrentSession })
  } catch (error) {
    next(error)
  }
})

module.exports = router
