import { useEffect, useMemo, useState } from "react"
import "./App.css"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api"
const today = new Date().toISOString().slice(0, 10)
const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
})

const emptyForm = {
  type: "expense",
  description: "",
  amount: "",
  category_id: "",
  transaction_date: today
}

function App() {
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true)
        setError("")

        const [transactionsResponse, categoriesResponse] = await Promise.all([
          fetch(`${API_URL}/transactions`),
          fetch(`${API_URL}/categories`)
        ])

        if (!transactionsResponse.ok || !categoriesResponse.ok) {
          throw new Error("No se pudieron cargar los datos")
        }

        const [transactionsData, categoriesData] = await Promise.all([
          transactionsResponse.json(),
          categoriesResponse.json()
        ])

        setTransactions(transactionsData)
        setCategories(categoriesData)
      } catch (requestError) {
        setError(requestError.message)
      } finally {
        setLoading(false)
      }
    }

    loadInitialData()
  }, [])

  const availableCategories = categories.filter(
    category => category.type === form.type
  )

  const summary = useMemo(() => {
    const income = transactions
      .filter(transaction => transaction.type === "income")
      .reduce((total, transaction) => total + transaction.amount, 0)

    const expenses = transactions
      .filter(transaction => transaction.type === "expense")
      .reduce((total, transaction) => total + transaction.amount, 0)

    return {
      income,
      expenses,
      balance: income - expenses
    }
  }, [transactions])

  const visibleTransactions = transactions.filter(transaction => {
    if (filter === "all") return true
    return transaction.type === filter
  })

  function updateField(event) {
    const { name, value } = event.target

    if (name === "type") {
      setForm(current => ({
        ...current,
        type: value,
        category_id: ""
      }))
      return
    }

    setForm(current => ({ ...current, [name]: value }))
  }

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
  }

  function startEditing(transaction) {
    setEditingId(transaction.id)
    setForm({
      type: transaction.type,
      description: transaction.description,
      amount: String(transaction.amount),
      category_id: String(transaction.category_id),
      transaction_date: transaction.transaction_date.slice(0, 10)
    })
  }

  async function submitTransaction(event) {
    event.preventDefault()

    if (!form.description.trim() || !form.amount || !form.category_id) {
      setError("Completa descripción, monto y categoría")
      return
    }

    try {
      setSaving(true)
      setError("")

      const endpoint = editingId
        ? `${API_URL}/transactions/${editingId}`
        : `${API_URL}/transactions`

      const response = await fetch(endpoint, {
        method: editingId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          type: form.type,
          description: form.description.trim(),
          amount: Number(form.amount),
          category_id: Number(form.category_id),
          transaction_date: form.transaction_date
        })
      })

      const payload = response.status === 204 ? null : await response.json()

      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo guardar la transacción")
      }

      if (editingId) {
        setTransactions(current =>
          current.map(transaction =>
            transaction.id === editingId ? payload : transaction
          )
        )
      } else {
        setTransactions(current => [payload, ...current])
      }

      resetForm()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteTransaction(id) {
    try {
      setError("")
      const response = await fetch(`${API_URL}/transactions/${id}`, {
        method: "DELETE"
      })

      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || "No se pudo eliminar la transacción")
      }

      setTransactions(current =>
        current.filter(transaction => transaction.id !== id)
      )

      if (editingId === id) {
        resetForm()
      }
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Personal finance</p>
          <h1>Finance App</h1>
        </div>
        <span className="status-pill">Portfolio v1 · local</span>
      </header>

      <section className="summary-grid" aria-label="Financial summary">
        <article className="summary-card">
          <span>Balance</span>
          <strong>{money.format(summary.balance)}</strong>
        </article>
        <article className="summary-card">
          <span>Income</span>
          <strong>{money.format(summary.income)}</strong>
        </article>
        <article className="summary-card">
          <span>Expenses</span>
          <strong>{money.format(summary.expenses)}</strong>
        </article>
      </section>

      <section className="workspace">
        <article className="panel form-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Transaction</p>
              <h2>{editingId ? "Edit transaction" : "New transaction"}</h2>
            </div>
            {editingId && (
              <button className="text-button" type="button" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={submitTransaction} className="transaction-form">
            <label>
              Type
              <select name="type" value={form.type} onChange={updateField}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </label>

            <label>
              Description
              <input
                name="description"
                value={form.description}
                onChange={updateField}
                placeholder="e.g. Supermarket"
                maxLength="200"
              />
            </label>

            <div className="form-row">
              <label>
                Amount
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={updateField}
                  placeholder="0.00"
                />
              </label>

              <label>
                Date
                <input
                  name="transaction_date"
                  type="date"
                  value={form.transaction_date}
                  onChange={updateField}
                />
              </label>
            </div>

            <label>
              Category
              <select
                name="category_id"
                value={form.category_id}
                onChange={updateField}
              >
                <option value="">Select category</option>
                {availableCategories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save changes" : "Add transaction"}
            </button>
          </form>

          {error && <p className="error-message">{error}</p>}
        </article>

        <article className="panel transactions-panel">
          <div className="section-heading transactions-heading">
            <div>
              <p className="eyebrow">Activity</p>
              <h2>Transactions</h2>
            </div>

            <select
              className="filter-select"
              value={filter}
              onChange={event => setFilter(event.target.value)}
              aria-label="Filter transactions"
            >
              <option value="all">All</option>
              <option value="income">Income</option>
              <option value="expense">Expenses</option>
            </select>
          </div>

          {loading ? (
            <p className="empty-state">Loading transactions...</p>
          ) : visibleTransactions.length === 0 ? (
            <p className="empty-state">No transactions yet.</p>
          ) : (
            <div className="transaction-list">
              {visibleTransactions.map(transaction => (
                <div className="transaction-row" key={transaction.id}>
                  <div className={`transaction-icon ${transaction.type}`}>
                    {transaction.type === "income" ? "+" : "−"}
                  </div>

                  <div className="transaction-main">
                    <strong>{transaction.description}</strong>
                    <span>
                      {transaction.category_name || "Uncategorized"} · {transaction.transaction_date.slice(0, 10)}
                    </span>
                  </div>

                  <strong className={`transaction-amount ${transaction.type}`}>
                    {transaction.type === "income" ? "+" : "−"}
                    {money.format(transaction.amount)}
                  </strong>

                  <div className="row-actions">
                    <button type="button" onClick={() => startEditing(transaction)}>
                      Edit
                    </button>
                    <button type="button" onClick={() => deleteTransaction(transaction.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  )
}

export default App
