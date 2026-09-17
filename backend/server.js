require("dotenv").config()

const express = require("express")
const cors = require("cors")
const pool = require("./src/db")
const transactionsRouter = require("./src/routes/transactions")
const categoriesRouter = require("./src/routes/categories")

const app = express()
const PORT = Number(process.env.PORT || 3000)

app.use(cors())
app.use(express.json())

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1")
    res.json({ status: "ok", database: "connected" })
  } catch (error) {
    console.error(error)
    res.status(500).json({ status: "error", database: "disconnected" })
  }
})

app.use("/api/transactions", transactionsRouter)
app.use("/api/categories", categoriesRouter)

app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" })
})

app.listen(PORT, () => {
  console.log(`Backend funcionando en http://localhost:${PORT}`)
})
