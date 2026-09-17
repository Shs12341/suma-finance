function normalizedOrigin(value) {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function requireTrustedOrigin(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next()

  const configuredOrigin = normalizedOrigin(process.env.CLIENT_ORIGIN || "http://localhost:5173")
  const requestOrigin = req.get("origin")

  // Browsers send Origin on fetch/XHR writes. Requests without Origin are allowed
  // for trusted CLI/API tooling; authenticated writes still require the CSRF token.
  if (!requestOrigin) return next()

  if (!configuredOrigin || normalizedOrigin(requestOrigin) !== configuredOrigin) {
    return res.status(403).json({ error: "Origen no permitido" })
  }

  next()
}

module.exports = requireTrustedOrigin
