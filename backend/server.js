const envPath = require("./src/loadEnv")

const express = require("express")
const cors = require("cors")
const cookieParser = require("cookie-parser")
const pool = require("./src/db")
const authRouter = require("./src/routes/auth")
const transactionsRouter = require("./src/routes/transactions")
const categoriesRouter = require("./src/routes/categories")
const budgetsRouter = require("./src/routes/budgets")
const goalsRouter = require("./src/routes/goals")
const analyticsRouter = require("./src/routes/analytics")

const app = express()
const PORT = Number(process.env.PORT || 3000)
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173"

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("Configura JWT_SECRET (mínimo 32 caracteres). Ejecuta setup-local.ps1")
}

app.use(cors({
  origin: CLIENT_ORIGIN,
  credentials: true
}))
app.use(express.json({ limit: "100kb" }))
app.use(cookieParser())

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1")
    res.json({ status: "ok", database: "connected" })
  } catch (error) {
    console.error(error)
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
  console.error(error)

  if (res.headersSent) {
    return next(error)
  }

  res.status(error.statusCode || 500).json({
    error: error.statusCode ? error.message : "Error interno del servidor"
  })
})

app.listen(PORT, () => {
  console.log(`Backend funcionando en http://localhost:${PORT}`)
  console.log(`Configuración local: ${envPath}`)
})
