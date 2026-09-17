const jwt = require("jsonwebtoken")

const COOKIE_NAME = process.env.COOKIE_NAME || "finance_session"
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

function getJwtSecret() {
  const secret = process.env.JWT_SECRET

  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET no está configurado o es demasiado corto")
  }

  return secret
}

function createSessionToken(user, tokenId) {
  if (!tokenId) throw new Error("tokenId es obligatorio para crear una sesión")

  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      jti: tokenId
    },
    getJwtSecret(),
    { expiresIn: "7d" }
  )
}

function verifySessionToken(token) {
  return jwt.verify(token, getJwtSecret())
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS,
    path: "/"
  }
}

function clearCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  }
}

module.exports = {
  COOKIE_NAME,
  SESSION_TTL_MS,
  createSessionToken,
  verifySessionToken,
  cookieOptions,
  clearCookieOptions
}
