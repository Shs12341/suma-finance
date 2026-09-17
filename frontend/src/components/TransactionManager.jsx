import { useCallback, useEffect, useMemo, useState } from "react"
import { ApiError, apiFetch } from "../services/api"

const today = new Date().toISOString().slice(0, 10)
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

const emptyForm = {
  type: "expense",
  description: "",
  amount: "",
  category_id: "",
  transaction_date: today
}

function TransactionManager({ categories, onDataChanged, onSessionExpired }) {
  const [transactions, setTransactions] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [typeFilter, setTypeFilter] = useState("all")
  const [monthFilter, setMonthFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleRequestError = useCallback((requestError) => {
    if (requestError instanceof ApiError && requestError.status === 401) {
      onSessionExpired()
      return
    }
    setError(requestError.message)
  }, [onSessionExpired])

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true)
      setError("")
      setTransactions(await apiFetch("/transactions"))
    } catch (requestError) {
      handleRequestError(requestError)
    } finally {
      setLoading(false)
    }
  }, [handleRequestError])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  const availableCategories = categories.filter(category => category.type === form.type)

  const monthOptions = useMemo(() => {
    return [...new Set(transactions.map(transaction => transaction.transaction_date.slice(0, 7)))].sort().reverse()
  }, [transactions])

  const visibleTransactions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return transactions.filter(transaction => {
      if (typeFilter !== "all" && transaction.type !== typeFilter) return false
      if (monthFilter !== "all" && transaction.transaction_date.slice(0, 7) !== monthFilter) return false
      if (normalizedSearch) {
        const haystack = `${transaction.description} ${transaction.category_name || ""}`.toLowerCase()
        if (!haystack.includes(normalizedSearch)) return false
      }
      return true
    })
  }, [transactions, typeFilter, monthFilter, search])

  function updateField(event) {
    const { name, value } = event.target

    if (name === "type") {
      setForm(current => ({ ...current, type: value, category_id: "" }))
      return
    }

    setForm(current => ({ ...current, [name]: value }))
  }

  function resetForm() {
    setForm({ ...emptyForm, transaction_date: new Date().toISOString().slice(0, 10) })
    setEditingId(null)
  }

  function startEditing(transaction) {
    setEditingId(transaction.id)
    setForm({
      type: transaction.type,
      description: transaction.description,
      amount: String(transaction.amount),
      category_id: transaction.category_id ? String(transaction.category_id) : "",
      transaction_date: transaction.transaction_date.slice(0, 10)
    })
    window.scrollTo({ top: 120, behavior: "smooth" })
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

      const endpoint = editingId ? `/transactions/${editingId}` : "/transactions"
      const payload = await apiFetch(endpoint, {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify({
          type: form.type,
          description: form.description.trim(),
          amount: Number(form.amount),
          category_id: Number(form.category_id),
          transaction_date: form.transaction_date
        })
      })

      if (editingId) {
        setTransactions(current => current.map(transaction => transaction.id === editingId ? payload : transaction))
      } else {
        setTransactions(current => [payload, ...current])
      }

      resetForm()
      onDataChanged()
    } catch (requestError) {
      handleRequestError(requestError)
    } finally {
      setSaving(false)
    }
  }

  async function deleteTransaction(id) {
    try {
      setError("")
      await apiFetch(`/transactions/${id}`, { method: "DELETE" })
      setTransactions(current => current.filter(transaction => transaction.id !== id))
      if (editingId === id) resetForm()
      onDataChanged()
    } catch (requestError) {
      handleRequestError(requestError)
    }
  }

  return (
    <section className="workspace transaction-workspace">
      <article className="panel form-panel sticky-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Transaction</p>
            <h2>{editingId ? "Edit transaction" : "New transaction"}</h2>
          </div>
          {editingId && <button className="text-button" type="button" onClick={resetForm}>Cancel</button>}
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
            <input name="description" value={form.description} onChange={updateField} placeholder="e.g. Supermarket" maxLength="200" />
          </label>

          <div className="form-row">
            <label>
              Amount
              <input name="amount" type="number" min="0.01" step="0.01" value={form.amount} onChange={updateField} placeholder="0.00" />
            </label>
            <label>
              Date
              <input name="transaction_date" type="date" value={form.transaction_date} onChange={updateField} />
            </label>
          </div>

          <label>
            Category
            <select name="category_id" value={form.category_id} onChange={updateField}>
              <option value="">Select category</option>
              {availableCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>

          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? "Saving..." : editingId ? "Save changes" : "Add transaction"}
          </button>
        </form>

        {error && <p className="error-message">{error}</p>}
      </article>

      <article className="panel transactions-panel">
        <div className="section-heading transaction-heading-stack">
          <div>
            <p className="eyebrow">Activity</p>
            <h2>Transaction history</h2>
          </div>
          <span className="count-badge">{visibleTransactions.length} shown</span>
        </div>

        <div className="transaction-filters">
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search transactions..." />
          <select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}>
            <option value="all">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expenses</option>
          </select>
          <select value={monthFilter} onChange={event => setMonthFilter(event.target.value)}>
            <option value="all">All months</option>
            {monthOptions.map(month => <option key={month} value={month}>{month}</option>)}
          </select>
        </div>

        {loading ? (
          <p className="empty-state">Loading transactions...</p>
        ) : visibleTransactions.length === 0 ? (
          <p className="empty-state">No transactions match these filters.</p>
        ) : (
          <div className="transaction-list">
            {visibleTransactions.map(transaction => (
              <div className="transaction-row" key={transaction.id}>
                <div className={`transaction-icon ${transaction.type}`}>{transaction.type === "income" ? "+" : "−"}</div>
                <div className="transaction-main">
                  <strong>{transaction.description}</strong>
                  <span>{transaction.category_name || "Uncategorized"} · {transaction.transaction_date.slice(0, 10)}</span>
                </div>
                <strong className={`transaction-amount ${transaction.type}`}>
                  {transaction.type === "income" ? "+" : "−"}{money.format(transaction.amount)}
                </strong>
                <div className="row-actions">
                  <button type="button" onClick={() => startEditing(transaction)}>Edit</button>
                  <button type="button" onClick={() => deleteTransaction(transaction.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  )
}

export default TransactionManager
