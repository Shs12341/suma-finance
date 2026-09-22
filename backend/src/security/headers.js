function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("X-Frame-Options", "DENY")
  res.setHeader("Referrer-Policy", "no-referrer")
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  )
  res.setHeader("Cross-Origin-Resource-Policy", "same-site")
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin")

  if (req.path.startsWith("/api")) {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    )
  } else {
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'"
      ].join("; ")
    )
  }

  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    )
  }

  if (req.path.startsWith("/api/auth")) {
    res.setHeader("Cache-Control", "no-store")
  }

  next()
}

module.exports = securityHeaders

module.exports = securityHeaders
