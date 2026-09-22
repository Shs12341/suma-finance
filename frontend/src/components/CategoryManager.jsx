import { useState } from "react"
import { ApiError, apiFetch } from "../services/api"
import ConfirmDialog from "./ConfirmDialog"
import Icon from "./Icon"

function CategoryManager({ categories, refreshCategories, onDataChanged, onSessionExpired }) {
  const [form, setForm] = useState({ name: "", type: "expense" })
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  function handleRequestError(requestError) {
    if (requestError instanceof ApiError && requestError.status === 401) {
      onSessionExpired()
      return
    }
    setError(requestError.message)
  }

  function resetForm() {
    setForm({ name: "", type: "expense" })
    setEditingId(null)
  }

  function editCategory(category) {
    setEditingId(category.id)
    setForm({ name: category.name, type: category.type })
  }

  async function submitCategory(event) {
    event.preventDefault()
    if (!form.name.trim()) {
      setError("Give the category a name before saving.")
      return
    }

    try {
      setSaving(true)
      setError("")
      await apiFetch(editingId ? `/categories/${editingId}` : "/categories", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify({ name: form.name.trim(), type: form.type })
      })
      resetForm()
      await refreshCategories()
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
      await apiFetch(`/categories/${deleteTarget.id}`, { method: "DELETE" })
      if (editingId === deleteTarget.id) resetForm()
      setDeleteTarget(null)
      await refreshCategories()
      onDataChanged()
    } catch (requestError) {
      handleRequestError(requestError)
    } finally {
      setDeleting(false)
    }
  }

  const groups = [
    { type: "expense", title: "Money out", copy: "The everyday places your money goes." },
    { type: "income", title: "Money in", copy: "Where your income comes from." }
  ]

  return (
    <>
      <section className="category-layout journal-page">
        <article className="panel category-form-panel friendly-form-panel journal-form-panel">
          <div className="section-heading friendly-heading">
            <div>
              <span className="eyebrow">Keep things tidy</span>
              <h2>{editingId ? "Edit category" : "Create a category"}</h2>
              <p>{editingId ? "Update the name or type." : "Use names that make sense at a glance."}</p>
            </div>
            {editingId && <button className="text-button" type="button" onClick={resetForm}>Cancel edit</button>}
          </div>

          <form className="transaction-form friendly-form" onSubmit={submitCategory}>
            <label>
              <span>Category name</span>
              <input value={form.name} maxLength="100" placeholder="Health, Rent, Freelance..." onChange={event => setForm(current => ({ ...current, name: event.target.value }))} />
            </label>
            <fieldset className="type-picker">
              <legend>Used for</legend>
              <div className="segmented-control">
                <button type="button" className={form.type === "expense" ? "active expense-choice" : ""} onClick={() => setForm(current => ({ ...current, type: "expense" }))}>
                  <Icon name="expense" size={16} /> Expenses
                </button>
                <button type="button" className={form.type === "income" ? "active income-choice" : ""} onClick={() => setForm(current => ({ ...current, type: "income" }))}>
                  <Icon name="income" size={16} /> Income
                </button>
              </div>
            </fieldset>
            <button className="primary-button friendly-primary" type="submit" disabled={saving}>{saving ? "Saving..." : editingId ? "Save changes" : "Create category"}</button>
          </form>
          {error && <p className="error-message">{error}</p>}
        </article>

        <div className="category-groups">
          {groups.map(group => (
            <article className="panel category-group-card" key={group.type}>
              <div className="section-heading friendly-heading">
                <div>
                  <span className="eyebrow">{group.type === "expense" ? "Expenses" : "Income"}</span>
                  <h2>{group.title}</h2>
                  <p>{group.copy}</p>
                </div>
                <span className="count-badge">{categories.filter(category => category.type === group.type).length}</span>
              </div>

              <div className="category-list">
                {categories.filter(category => category.type === group.type).map(category => (
                  <div className="category-row" key={category.id}>
                    <div className={`category-mark ${group.type}`}><Icon name={group.type === "income" ? "income" : "expense"} size={14} /></div>
                    <strong>{category.name}</strong>
                    <div className="row-actions">
                      <button className="row-icon-button" type="button" onClick={() => editCategory(category)}><Icon name="edit" size={15} /><span>Edit</span></button>
                      <button className="row-icon-button danger" type="button" onClick={() => setDeleteTarget(category)}><Icon name="trash" size={15} /><span>Delete</span></button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget ? `Delete “${deleteTarget.name}”?` : "Delete category?"}
        message="This category can’t be restored. If it’s already used, the server will keep your financial data safe and reject anything that would break its references."
        confirmLabel="Delete category"
        tone="danger"
        busy={deleting}
        onCancel={() => !deleting && setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </>
  )
}

export default CategoryManager
