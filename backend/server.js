require("dotenv").config()

const express = require("express")
const cors = require("cors")

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

let gastos = [
  { id: 1, nombre: "Comida", valor: 30 },
  { id: 2, nombre: "Gasolina", valor: 20 },
  { id: 3, nombre: "Internet", valor: 40 }
]

app.get("/api/gastos", (req, res) => {
  res.json(gastos)
})

app.post("/api/gastos", (req, res) => {
  const nuevoGasto = {
    id: Date.now(),
    nombre: req.body.nombre,
    valor: Number(req.body.valor)
  }

  gastos.push(nuevoGasto)

  res.status(201).json(nuevoGasto)
})

app.delete("/api/gastos/:id", (req, res) => {
  const id = Number(req.params.id)

  gastos = gastos.filter(gasto => gasto.id !== id)

  res.status(204).send()
})

app.listen(PORT, () => {
  console.log(`Backend funcionando en http://localhost:${PORT}`)
})
