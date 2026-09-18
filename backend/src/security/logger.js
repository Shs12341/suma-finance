const crypto = require("crypto")

const SAFE_METADATA_KEYS = new Set([
  "status",
  "outcome",
  "reason",
  "category",
  "resource",
  "resource_id",
  "session_id",
  "revoked_count",
  "limit",
  "window_seconds",
  "error_name",
  "error_code",
  "error_type",
  "error_status"
])

function cleanPath(req) {
  const raw = String(req?.originalUrl || req?.url || "")
  return raw.split("?")[0].slice(0, 240)
}

function pseudonymize(value) {
  if (!value) return undefined
  const secret = process.env.JWT_SECRET || "finance-app-local-log-key"
  return crypto
    .createHmac("sha256", secret)
    .update(String(value))
    .digest("hex")
    .slice(0, 16)
}

function requestIdMiddleware(req, res, next) {
  const incoming = String(req.get?.("x-request-id") || "")
  const requestId = /^[A-Za-z0-9._:-]{8,80}$/.test(incoming)
    ? incoming
    : crypto.randomUUID()

  req.requestId = requestId
  res.setHeader("X-Request-ID", requestId)
  next()
}

function sanitizeMetadata(metadata = {}) {
  const safe = {}

  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_METADATA_KEYS.has(key)) continue
    if (!["string", "number", "boolean"].includes(typeof value)) continue
    safe[key] = typeof value === "string" ? value.slice(0, 160) : value
  }

  return safe
}

function buildRecord(level, event, req, metadata = {}) {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    event,
    request_id: req?.requestId || crypto.randomUUID(),
    method: req?.method,
    path: cleanPath(req),
    ...sanitizeMetadata(metadata)
  }

  if (req?.user?.id) record.user_id = req.user.id

  const ip = req?.ip || req?.socket?.remoteAddress
  if (ip) record.network_id = pseudonymize(ip)

  return record
}

function write(level, event, req, metadata) {
  const line = JSON.stringify(buildRecord(level, event, req, metadata))

  if (level === "error") {
    console.error(line)
  } else if (level === "warn") {
    console.warn(line)
  } else {
    console.log(line)
  }
}

function responseAuditMiddleware(req, res, next) {
  res.on("finish", () => {
    if ([400, 401, 403, 404, 409, 429].includes(res.statusCode)) {
      write("warn", "request_rejected", req, {
        status: res.statusCode,
        outcome: "denied",
        category: "http_rejection"
      })
    }
  })
  next()
}

function securityEvent(event, req, metadata = {}) {
  write("info", event, req, metadata)
}

function securityWarning(event, req, metadata = {}) {
  write("warn", event, req, metadata)
}

function safeError(error, req, metadata = {}) {
  write("error", "request_error", req, {
    ...metadata,
    error_name: String(error?.name || "Error"),
    error_code: error?.code ? String(error.code) : "unknown",
    error_type: error?.type ? String(error.type) : "unknown",
    error_status: Number(error?.statusCode || error?.status || metadata.status || 500)
  })
}

module.exports = {
  requestIdMiddleware,
  responseAuditMiddleware,
  securityEvent,
  securityWarning,
  safeError
}
