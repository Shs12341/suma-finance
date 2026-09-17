import { useEffect, useState } from "react"

function App() {
  const ingresos = 1800

  const [gastos, setGastos] = useState([])
  const [nombre, setNombre] = useState("")
  const [valor, setValor] = useState("")

  useEffect(() => {
    async function cargarGastos() {
      const respuesta = await fetch("http://localhost:3000/api/gastos")
      const datos = await respuesta.json()

      setGastos(datos)
    }

    cargarGastos()
  }, [])

  async function agregarGasto() {
    if (!nombre || !valor) {
      return
    }

    const respuesta = await fetch("http://localhost:3000/api/gastos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        nombre,
        valor: Number(valor)
      })
    })

    const nuevoGasto = await respuesta.json()

    setGastos([...gastos, nuevoGasto])

    setNombre("")
    setValor("")
  }

  async function eliminarGasto(id) {
    await fetch(`http://localhost:3000/api/gastos/${id}`, {
      method: "DELETE"
    })

    setGastos(gastos.filter(gasto => gasto.id !== id))
  }

  const gastosTotal = gastos.reduce(
    (acumulado, gasto) => acumulado + gasto.valor,
    0
  )

  const saldo = ingresos - gastosTotal

  return (
    <div>
      <h1>Finance App</h1>

      <h2>Resumen</h2>

      <p>Saldo: ${saldo}</p>
      <p>Ingresos: ${ingresos}</p>
      <p>Gastos: ${gastosTotal}</p>

      <h2>Agregar gasto</h2>

      <input
        type="text"
        placeholder="Nombre del gasto"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />

      <input
        type="number"
        placeholder="Valor"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
      />

      <button onClick={agregarGasto}>
        Agregar
      </button>

      <h2>Últimos gastos</h2>

      {gastos.map(gasto => (
        <div key={gasto.id}>
          <span>
            {gasto.nombre} - ${gasto.valor}
          </span>

          <button onClick={() => eliminarGasto(gasto.id)}>
            Eliminar
          </button>
        </div>
      ))}
    </div>
  )
}

export default App
