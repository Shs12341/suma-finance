import { useCallback, useEffect, useState } from "react"
import { ApiError, apiFetch } from "../services/api"
import ConfirmDialog from "./ConfirmDialog"
import Icon from "./Icon"

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
  const [nextCursor, setNextCursor] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [typeFilter, setTypeFilter] = useState("all")
  const [monthFilter, setMonthFilter] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const handleRequestError = useCallback((requestError) => {
    if (requestError instanceof ApiError && requestError.status === 401) {
      onSessionExpired()
      return
    }
    setError(requestError.message)
  }, [onSessionExpired])

  const requestTransactions = useCallback(async ({ append = false, cursor = null } = {}) => {
    const params = new URLSearchParams({ limit: "30" })
    if (typeFilter !== "all") params.set("type", typeFilter)
    if (monthFilter) params.set("month", monthFilter)
    if (search.trim()) params.set("search", search.trim())
    if (cursor) params.set("cursor", cursor)

    try {
      append ? setLoadingMore(true) : setLoading(true)
      setError("")
      const data = await apiFetch(`/transactions?${params.toString()}`)
      setTransactions(current => append ? [...current, ...data.items] : data.items)
      setNextCursor(data.next_cursor)
    } catch (requestError) {
      handleRequestError(requestError)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [handleRequestError, monthFilter, search, typeFilter])

  useEffect(() => {
    const timer = window.setTimeout(() => requestTransactions(), 250)
    return () => window.clearTimeout(timer)
  }, [requestTransactions])

  const availableCategories = categories.filter(category => category.type === form.type)

  function updateField(event) {
    const { name, value } = event.target
    setForm(current => ({ ...current, [name]: value }))
  }

  function setType(type) {
    setForm(current => ({ ...current, type, category_id: "" }))
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
    window.scrollTo({ top: 90, behavior: "smooth" })
  }

  async function submitTransaction(event) {
    event.preventDefault()
    if (!form.description.trim() || !form.amount || !form.category_id) {
      setError("Add a description, amount and category before saving.")
      return
    }

    try {
      setSaving(true)
      setError("")
      const endpoint = editingId ? `/transactions/${editingId}` : "/transactions"
      await apiFetch(endpoint, {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify({
          type: form.type,
          description: form.description.trim(),
          amount: form.amount,
          category_id: Number(form.category_id),
          transaction_date: form.transaction_date
        })
      })

      resetForm()
      await requestTransactions()
      onDataChanged()
    } catch (requestError) {
      handleRequestError(requestError)
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      setError("")
      await apiFetch(`/transactions/${deleteTarget.id}`, { method: "DELETE" })
      if (editingId === deleteTarget.id) resetForm()
      setDeleteTarget(null)
      await requestTransactions()
      onDataChanged()
    } catch (requestError) {
      handleRequestError(requestError)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <section className="workspace transaction-workspace journal-page">
        <article className="panel form-panel sticky-panel friendly-form-panel journal-form-panel">
          <div className="section-heading friendly-heading">
            <div>
              <span className="eyebrow">{editingId ? "Editing your journal" : "New journal entry"}</span>
              <h2>{editingId ? "Edit transaction" : "Add transaction"}</h2>
              <p>{editingId ? "Change only what you need." : "Record it now so the month stays clear."}</p>
            </div>
            {editingId && <button className="text-button" type="button" onClick={resetForm}>Cancel edit</button>}
          </div>

          <form onSubmit={submitTransaction} className="transaction-form friendly-form">
            <fieldset className="type-picker">
              <legend>What kind of movement?</legend>
              <div className="segmented-control">
                <button type="button" className={form.type === "expense" ? "active expense-choice" : ""} onClick={() => setType("expense")}>
                  <Icon name="expense" size={16} /> Expense
                </button>
                <button type="button" className={form.type === "income" ? "active income-choice" : ""} onClick={() => setType("income")}>
                  <Icon name="income" size={16} /> Income
                </button>
              </div>
            </fieldset>

            <label>
              <span>What was it?</span>
              <input name="description" value={form.description} onChange={updateField} placeholder="Supermarket, salary, coffee..." maxLength="200" />
            </label>

            <div className="form-row">
              <label><span>How much?</span><div className="money-input"><span>$</span><input name="amount" type="number" min="0.01" max="9999999999.99" step="0.01" value={form.amount} onChange={updateField} placeholder="0.00" /></div></label>
              <label><span>When?</span><input name="transaction_date" type="date" value={form.transaction_date} onChange={updateField} /></label>
            </div>

            <label>
              <span>Category</span>
              <select name="category_id" value={form.category_id} onChange={updateField}>
                <option value="">Choose one</option>
                {availableCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>

            <button className="primary-button friendly-primary" type="submit" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save changes" : form.type === "income" ? "Add income" : "Add expense"}
            </button>
          </form>
          {error && <p className="error-message">{error}</p>}
        </article>

        <article className="panel transactions-panel activity-panel journal-list-panel">
          <div className="section-heading friendly-heading activity-heading">
            <div>
              <span className="eyebrow">Your history</span>
              <h2>Transaction history</h2>
              <p>Search, filter and edit everything that moved.</p>
            </div>
            <span className="count-badge">{transactions.length} shown</span>
          </div>

          <div className="transaction-filters">
            <div className="search-field"><Icon name="search" size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by description..." maxLength="100" /></div>
            <select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}>
              <option value="all">All activity</option><option value="income">Income</option><option value="expense">Expenses</option>
            </select>
            <input type="month" value={monthFilter} onChange={event => setMonthFilter(event.target.value)} aria-label="Filter by month" />
            {monthFilter && <button className="text-button" type="button" onClick={() => setMonthFilter("")}>Clear month</button>}
          </div>

          {loading ? <p className="empty-state">Bringing your activity in...</p> : transactions.length === 0 ? (
            <div className="empty-state illustrated-empty"><span>◎</span><strong>Nothing here yet</strong><p>Try another filter or add your first transaction.</p></div>
          ) : (
            <>
              <div className="transaction-list">
                {transactions.map(transaction => (
                  <div className="transaction-row" key={transaction.id}>
                    <div className={`transaction-icon ${transaction.type}`}><Icon name={transaction.type === "income" ? "income" : "expense"} size={17} /></div>
                    <div className="transaction-main"><strong>{transaction.description}</strong><span>{transaction.category_name || "Uncategorized"} · {transaction.transaction_date.slice(0, 10)}</span></div>
                    <strong className={`transaction-amount ${transaction.type}`}>{transaction.type === "income" ? "+" : "−"}{money.format(transaction.amount)}</strong>
                    <div className="row-actions">
                      <button className="row-icon-button" type="button" onClick={() => startEditing(transaction)} title="Edit transaction"><Icon name="edit" size={15} /><span>Edit</span></button>
                      <button className="row-icon-button danger" type="button" onClick={() => setDeleteTarget(transaction)} title="Delete transaction"><Icon name="trash" size={15} /><span>Delete</span></button>
                    </div>
                  </div>
                ))}
              </div>
              {nextCursor && (
                <button className="secondary-button load-more-button" type="button" disabled={loadingMore} onClick={() => requestTransactions({ append: true, cursor: nextCursor })}>
                  {loadingMore ? "Loading..." : "Show more activity"}
                </button>
              )}
            </>
          )}
        </article>
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this transaction?"
        message={deleteTarget ? `“${deleteTarget.description}” will be removed from your activity. This can’t be undone.` : ""}
        confirmLabel="Delete transaction"
        tone="danger"
        busy={deleting}
        onCancel={() => !deleting && setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </>
  )
}

export default TransactionManager
