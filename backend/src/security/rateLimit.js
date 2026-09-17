const buckets = new Map()

function nowMs() {
  return Date.now()
}

function normalizeKey(value) {
  return String(value || "unknown").trim().toLowerCase().slice(0, 250)
}

function createRateLimiter({ windowMs, max, keyGenerator, message }) {
  return function rateLimiter(req, res, next) {
    const key = normalizeKey(keyGenerator(req))
    const now = nowMs()
    let entry = buckets.get(key)

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs }
    }

    entry.count += 1
    buckets.set(key, entry)

    const remaining = Math.max(0, max - entry.count)
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))

    res.setHeader("RateLimit-Limit", String(max))
    res.setHeader("RateLimit-Remaining", String(remaining))
    res.setHeader("RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)))

    if (entry.count > max) {
      res.setHeader("Retry-After", String(retryAfterSeconds))
      return res.status(429).json({ error: message || "Demasiados intentos. Intenta nuevamente más tarde." })
    }

    next()
  }
}

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || "unknown"
}

function credentialKey(req) {
  const email = String(req.body?.email || "").trim().toLowerCase()
  return `credential:${email || "missing"}:${clientIp(req)}`
}

const AUTH_WINDOW_MS = 15 * 60 * 1000

const authIpLimiter = createRateLimiter({
  windowMs: AUTH_WINDOW_MS,
  max: 30,
  keyGenerator: req => `auth-ip:${clientIp(req)}`,
  message: "Demasiadas solicitudes de autenticación desde esta conexión. Intenta nuevamente en unos minutos."
})

const loginCredentialLimiter = createRateLimiter({
  windowMs: AUTH_WINDOW_MS,
  max: 10,
  keyGenerator: credentialKey,
  message: "Demasiados intentos para esta cuenta. Intenta nuevamente en unos minutos."
})

const registerIpLimiter = createRateLimiter({
  windowMs: AUTH_WINDOW_MS,
  max: 10,
  keyGenerator: req => `register-ip:${clientIp(req)}`,
  message: "Demasiados registros desde esta conexión. Intenta nuevamente en unos minutos."
})

const cleanupTimer = setInterval(() => {
  const now = nowMs()
  for (const [key, entry] of buckets.entries()) {
    if (entry.resetAt <= now) buckets.delete(key)
  }
}, 5 * 60 * 1000)
cleanupTimer.unref()

module.exports = {
  createRateLimiter,
  authIpLimiter,
  loginCredentialLimiter,
  registerIpLimiter
}
