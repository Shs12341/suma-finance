const crypto = require("crypto")
const { securityWarning } = require("./logger")

function csrfSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET inválido para CSRF")
  return secret
}

function createCsrfToken(tokenId) {
  return crypto
    .createHmac("sha256", csrfSecret())
    .update(`finance-csrf:${tokenId}`)
    .digest("base64url")
}

function safeEqual(a, b) {
  const first = Buffer.from(String(a || ""))
  const second = Buffer.from(String(b || ""))
  return first.length === second.length && first.length > 0 && crypto.timingSafeEqual(first, second)
}

function requireCsrf(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next()

  const tokenId = req.auth?.tokenId
  const provided = req.get("x-csrf-token")

  if (!tokenId || !provided || !safeEqual(provided, createCsrfToken(tokenId))) {
    securityWarning("csrf_validation_failed", req, { status: 403, outcome: "denied" })
    return res.status(403).json({ error: "Validación CSRF fallida" })
  }

  next()
}

module.exports = {
  createCsrfToken,
  requireCsrf
}
