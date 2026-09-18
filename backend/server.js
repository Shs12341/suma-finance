const envPath = require("./src/loadEnv")

const express = require("express")
const cors = require("cors")
const cookieParser = require("cookie-parser")
const pool = require("./src/db")
const securityHeaders = require("./src/security/headers")
const requireTrustedOrigin = require("./src/security/origin")
const authRouter = require("./src/routes/auth")
const transactionsRouter = require("./src/routes/transactions")
const categoriesRouter = require("./src/routes/categories")
const budgetsRouter = require("./src/routes/budgets")
const goalsRouter = require("./src/routes/goals")
const analyticsRouter = require("./src/routes/analytics")
const { requestIdMiddleware, responseAuditMiddleware, safeError } = require("./src/security/logger")

const app = express()
const PORT = Number(process.env.PORT || 3000)
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173"

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("Configura JWT_SECRET (mínimo 32 caracteres). Ejecuta setup-local.ps1")
}

app.disable("x-powered-by")
app.use(requestIdMiddleware)
app.use(responseAuditMiddleware)
app.use(securityHeaders)
app.use(cors({
  origin(origin, callback) {
    if (!origin || origin === CLIENT_ORIGIN) return callback(null, true)
    return callback(null, false)
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-CSRF-Token"],
  maxAge: 600
}))
app.use(express.json({ limit: "100kb", strict: true }))
app.use(cookieParser())
app.use(requireTrustedOrigin)

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1")
    res.json({ status: "ok", database: "connected" })
  } catch (error) {
    safeError(error, req, { status: 500, category: "database_health" })
    res.status(500).json({ status: "error", database: "disconnected" })
  }
})

app.use("/api/auth", authRouter)
app.use("/api/transactions", transactionsRouter)
app.use("/api/categories", categoriesRouter)
app.use("/api/budgets", budgetsRouter)
app.use("/api/goals", goalsRouter)
app.use("/api/analytics", analyticsRouter)

app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" })
})

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error)

  let status = 500
  let message = "Error interno del servidor"
  let category = "internal_error"

  if (error.type === "entity.parse.failed") {
    status = 400
    message = "JSON inválido"
    category = "invalid_json"
  } else if (error.type === "entity.too.large") {
    status = 413
    message = "La solicitud supera el tamaño permitido"
    category = "body_too_large"
  } else if (["22001", "22003", "22007", "22008", "22P02", "23514"].includes(error.code)) {
    status = 400
    message = "Los datos enviados no cumplen las restricciones permitidas"
    category = "database_constraint"
  } else if (error.code === "23505") {
    status = 409
    message = "El registro ya existe"
    category = "database_conflict"
  } else {
    const requestedStatus = Number(error.statusCode || error.status)
    if (Number.isInteger(requestedStatus) && requestedStatus >= 400 && requestedStatus < 500) {
      status = requestedStatus
      message = "Solicitud inválida"
      category = "client_error"
    }
  }

  // Never log the raw Error object here. Body-parser errors can carry the raw
  // request body, which may contain credentials or other sensitive values.
  safeError(error, req, { status, category })
  res.status(status).json({ error: message, request_id: req.requestId })
})

const server = app.listen(PORT, () => {
  console.log(`Backend funcionando en http://localhost:${PORT}`)
  console.log(`Configuración local: ${envPath}`)
})

const cleanupTimer = setInterval(() => {
  pool.query(
    `
      DELETE FROM auth_sessions
      WHERE expires_at < NOW() - INTERVAL '30 days'
         OR revoked_at < NOW() - INTERVAL '30 days'
    `
  ).catch(error => safeError(error, null, { status: 500, category: "session_cleanup" }))
}, 6 * 60 * 60 * 1000)
cleanupTimer.unref()

module.exports = { app, server }
