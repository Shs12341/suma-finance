const express = require("express")
const bcrypt = require("bcryptjs")
const pool = require("../db")
const requireAuth = require("../middleware/auth")
const defaultCategories = require("../defaultCategories")
const {
  COOKIE_NAME,
  createSessionToken,
  cookieOptions,
  clearCookieOptions
} = require("../auth")

const router = express.Router()

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase()
}

function validateCredentials({ name, email, password }, requireName) {
  const cleanName = String(name || "").trim()
  const cleanEmail = normalizeEmail(email)
  const cleanPassword = String(password || "")
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (requireName && (cleanName.length < 2 || cleanName.length > 100)) {
    return { error: "El nombre debe tener entre 2 y 100 caracteres" }
  }

  if (!emailPattern.test(cleanEmail) || cleanEmail.length > 150) {
    return { error: "Ingresa un correo válido" }
  }

  if (cleanPassword.length < 8 || cleanPassword.length > 72) {
    return { error: "La contraseña debe tener entre 8 y 72 caracteres" }
  }

  return {
    value: {
      name: cleanName,
      email: cleanEmail,
      password: cleanPassword
    }
  }
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    created_at: user.created_at
  }
}

router.post("/register", async (req, res, next) => {
  const validation = validateCredentials(req.body, true)

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

    await client.query("COMMIT")

    const token = createSessionToken(user)
    res.cookie(COOKIE_NAME, token, cookieOptions())
    res.status(201).json({ user: publicUser(user) })
  } catch (error) {
    await client.query("ROLLBACK")

    if (error.code === "23505") {
      return res.status(409).json({ error: "Ya existe una cuenta con ese correo" })
    }

    next(error)
  } finally {
    client.release()
  }
})

router.post("/login", async (req, res, next) => {
  const validation = validateCredentials(req.body, false)

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

    if (result.rowCount === 0) {
      return res.status(401).json({ error: "Correo o contraseña incorrectos" })
    }

    const user = result.rows[0]
    const hasBcryptHash = /^\$2[aby]\$/.test(user.password_hash)
    const passwordMatches = hasBcryptHash
      ? await bcrypt.compare(password, user.password_hash)
      : false

    if (!passwordMatches) {
      return res.status(401).json({ error: "Correo o contraseña incorrectos" })
    }

    const token = createSessionToken(user)
    res.cookie(COOKIE_NAME, token, cookieOptions())
    res.json({ user: publicUser(user) })
  } catch (error) {
    next(error)
  }
})

router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, clearCookieOptions())
  res.status(204).send()
})

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) })
})

module.exports = router
