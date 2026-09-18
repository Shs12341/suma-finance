import { useState } from "react"
import { ApiError, apiFetch } from "../services/api"
import Icon from "./Icon"

function CategoryManager({ categories, refreshCategories, onDataChanged, onSessionExpired }) {
  const [form, setForm] = useState({ name: "", type: "expense" })
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

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
      setError("El nombre de la categoría es obligatorio")
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

  async function deleteCategory(category) {
    const confirmed = window.confirm(`Delete ${category.name}? Existing transactions will become uncategorized.`)
    if (!confirmed) return

    try {
      setError("")
      await apiFetch(`/categories/${category.id}`, { method: "DELETE" })
      if (editingId === category.id) resetForm()
      await refreshCategories()
      onDataChanged()
    } catch (requestError) {
      handleRequestError(requestError)
    }
  }

  const groups = [
    { type: "expense", title: "Expense categories" },
    { type: "income", title: "Income categories" }
  ]

  return (
    <section className="category-layout">
      <article className="panel category-form-panel">
        <div className="section-heading">
          <div>
            <span className="section-index">RULE</span>
            <h2>{editingId ? "Edit category" : "New category"}</h2>
          </div>
          {editingId && <button className="text-button" type="button" onClick={resetForm}>Cancel</button>}
        </div>

        <form className="transaction-form" onSubmit={submitCategory}>
          <label>
            Name
            <input value={form.name} maxLength="100" placeholder="e.g. Health" onChange={event => setForm(current => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            Type
            <select value={form.type} onChange={event => setForm(current => ({ ...current, type: event.target.value }))}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </label>
          <button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving..." : editingId ? "Save changes" : "Create category"}</button>
        </form>
        {error && <p className="error-message">{error}</p>}
      </article>

      <div className="category-groups">
        {groups.map(group => (
          <article className="panel" key={group.type}>
            <div className="section-heading">
              <div>
                <span className="section-index">{group.type.toUpperCase()}</span>
                <h2>{group.title}</h2>
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
                    <button className="row-icon-button danger" type="button" onClick={() => deleteCategory(category)}><Icon name="trash" size={15} /><span>Delete</span></button>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default CategoryManager
