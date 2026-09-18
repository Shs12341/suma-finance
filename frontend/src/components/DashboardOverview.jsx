import { useCallback, useEffect, useMemo, useState } from "react"
import { ApiError, apiFetch } from "../services/api"
import Icon from "./Icon"

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
const currentMonth = new Date().toISOString().slice(0, 7)

function monthLabel(value) {
  const [year, month] = value.split("-")
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit", timeZone: "UTC" })
    .format(new Date(`${year}-${month}-01T00:00:00Z`))
}

function DashboardOverview({ categories, refreshKey, onDataChanged, onSessionExpired }) {
  const [month, setMonth] = useState(currentMonth)
  const [analytics, setAnalytics] = useState(null)
  const [budgets, setBudgets] = useState([])
  const [goals, setGoals] = useState([])
  const [budgetForm, setBudgetForm] = useState({ category_id: "", amount: "" })
  const [goalForm, setGoalForm] = useState({ name: "", target_amount: "", saved_amount: "", target_date: "" })
  const [goalContributions, setGoalContributions] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const handleRequestError = useCallback((requestError) => {
    if (requestError instanceof ApiError && requestError.status === 401) {
      onSessionExpired()
      return
    }
    setError(requestError.message)
  }, [onSessionExpired])

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true)
      setError("")
      const [analyticsData, budgetsData, goalsData] = await Promise.all([
        apiFetch(`/analytics?month=${month}&months=6`),
        apiFetch(`/budgets?month=${month}`),
        apiFetch("/goals")
      ])
      setAnalytics(analyticsData)
      setBudgets(budgetsData)
      setGoals(goalsData)
    } catch (requestError) {
      handleRequestError(requestError)
    } finally {
      setLoading(false)
    }
  }, [month, handleRequestError])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOverview()
  }, [loadOverview, refreshKey])

  const expenseCategories = categories.filter(category => category.type === "expense")

  const budgetTotals = useMemo(() => {
    const planned = budgets.reduce((sum, budget) => sum + budget.amount, 0)
    const spent = budgets.reduce((sum, budget) => sum + budget.spent, 0)
    return { planned, spent, remaining: planned - spent }
  }, [budgets])

  const chartMax = useMemo(() => {
    if (!analytics?.history?.length) return 1
    return Math.max(1, ...analytics.history.flatMap(item => [item.income, item.expenses]))
  }, [analytics])

  const expenseMax = useMemo(() => {
    if (!analytics?.expense_categories?.length) return 1
    return Math.max(1, ...analytics.expense_categories.map(item => item.amount))
  }, [analytics])

  async function saveBudget(event) {
    event.preventDefault()
    if (!budgetForm.category_id || !budgetForm.amount) {
      setError("Selecciona categoría y monto para el presupuesto")
      return
    }

    try {
      setError("")
      const saved = await apiFetch("/budgets", {
        method: "POST",
        body: JSON.stringify({
          category_id: Number(budgetForm.category_id),
          amount: Number(budgetForm.amount),
          month
        })
      })
      setBudgets(current => {
        const exists = current.some(item => item.id === saved.id)
        return exists
          ? current.map(item => item.id === saved.id ? saved : item)
          : [...current, saved].sort((a, b) => a.category_name.localeCompare(b.category_name))
      })
      setBudgetForm({ category_id: "", amount: "" })
      onDataChanged()
    } catch (requestError) {
      handleRequestError(requestError)
    }
  }

  async function deleteBudget(id) {
    try {
      setError("")
      await apiFetch(`/budgets/${id}`, { method: "DELETE" })
      setBudgets(current => current.filter(item => item.id !== id))
      onDataChanged()
    } catch (requestError) {
      handleRequestError(requestError)
    }
  }

  async function createGoal(event) {
    event.preventDefault()
    if (!goalForm.name.trim() || !goalForm.target_amount) {
      setError("Completa nombre y monto objetivo de la meta")
      return
    }

    try {
      setError("")
      const created = await apiFetch("/goals", {
        method: "POST",
        body: JSON.stringify({
          name: goalForm.name.trim(),
          target_amount: Number(goalForm.target_amount),
          saved_amount: Number(goalForm.saved_amount || 0),
          target_date: goalForm.target_date || null
        })
      })
      setGoals(current => [...current, created])
      setGoalForm({ name: "", target_amount: "", saved_amount: "", target_date: "" })
      onDataChanged()
    } catch (requestError) {
      handleRequestError(requestError)
    }
  }

  async function addToGoal(goal) {
    const amount = Number(goalContributions[goal.id])
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Ingresa un aporte mayor que cero")
      return
    }

    try {
      setError("")
      const updated = await apiFetch(`/goals/${goal.id}`, {
        method: "PATCH",
        body: JSON.stringify({ saved_amount: goal.saved_amount + amount })
      })
      setGoals(current => current.map(item => item.id === goal.id ? updated : item))
      setGoalContributions(current => ({ ...current, [goal.id]: "" }))
      onDataChanged()
    } catch (requestError) {
      handleRequestError(requestError)
    }
  }

  async function deleteGoal(id) {
    try {
      setError("")
      await apiFetch(`/goals/${id}`, { method: "DELETE" })
      setGoals(current => current.filter(item => item.id !== id))
      onDataChanged()
    } catch (requestError) {
      handleRequestError(requestError)
    }
  }

  const summary = analytics?.summary || { income: 0, expenses: 0, balance: 0, savings_rate: null }

  return (
    <section className="overview-stack">
      <div className="overview-toolbar">
        <div className="overview-intro">
          <span className="soft-kicker"><Icon name="sparkles" size={14} /> Monthly pulse</span>
          <p>Everything important for the selected month, at a glance.</p>
        </div>
        <label className="month-control">
          <span><Icon name="calendar" size={15} /> Month</span>
          <input type="month" value={month} onChange={event => setMonth(event.target.value)} />
        </label>
      </div>

      <section className="summary-grid summary-grid-four" aria-label="Monthly financial summary">
        <article className="summary-card summary-card-primary">
          <div className="summary-card-top"><div className="summary-icon"><Icon name="wallet" size={19} /></div><span>Net balance</span></div>
          <strong>{money.format(summary.balance)}</strong>
          <small>Available for {monthLabel(month)}</small>
          <div className="summary-orb" />
        </article>
        <article className="summary-card">
          <div className="summary-card-top"><div className="summary-icon income"><Icon name="income" size={18} /></div><span>Income</span></div>
          <strong>{money.format(summary.income)}</strong>
          <small><span className="positive-dot" /> Money in this month</small>
        </article>
        <article className="summary-card">
          <div className="summary-card-top"><div className="summary-icon expense"><Icon name="expense" size={18} /></div><span>Expenses</span></div>
          <strong>{money.format(summary.expenses)}</strong>
          <small><span className="negative-dot" /> Money out this month</small>
        </article>
        <article className="summary-card">
          <div className="summary-card-top"><div className="summary-icon savings"><Icon name="savings" size={18} /></div><span>Savings rate</span></div>
          <strong>{summary.savings_rate == null ? "—" : `${summary.savings_rate.toFixed(1)}%`}</strong>
          <small>{summary.savings_rate == null ? "Add income to calculate" : "Share of income kept"}</small>
        </article>
      </section>

      {error && <p className="error-message">{error}</p>}

      <section className="analytics-grid">
        <article className="panel chart-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Analytics</p>
              <h2>Income vs expenses</h2>
            </div>
            <span className="muted-label">Last 6 months</span>
          </div>

          {loading ? <p className="empty-state">Loading analytics...</p> : (
            <div className="bar-chart" aria-label="Income and expenses by month">
              {analytics?.history.map(item => (
                <div className="bar-column" key={item.month}>
                  <div className="bar-pair">
                    <div className="chart-bar income" style={{ height: `${Math.max(4, (item.income / chartMax) * 100)}%` }} title={`Income ${money.format(item.income)}`} />
                    <div className="chart-bar expense" style={{ height: `${Math.max(4, (item.expenses / chartMax) * 100)}%` }} title={`Expenses ${money.format(item.expenses)}`} />
                  </div>
                  <span>{monthLabel(item.month)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="chart-legend"><span><i className="legend-dot income" />Income</span><span><i className="legend-dot expense" />Expenses</span></div>
        </article>

        <article className="panel category-spend-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Breakdown</p>
              <h2>Spending by category</h2>
            </div>
          </div>
          {analytics?.expense_categories?.length ? (
            <div className="breakdown-list">
              {analytics.expense_categories.map(item => (
                <div className="breakdown-item" key={item.category_name}>
                  <div><strong>{item.category_name}</strong><span>{money.format(item.amount)}</span></div>
                  <div className="progress-track"><div className="progress-fill neutral" style={{ width: `${(item.amount / expenseMax) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          ) : <p className="empty-state compact">No expenses in this month yet.</p>}
        </article>
      </section>

      <section className="planning-grid">
        <article className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Planning</p>
              <h2>Monthly budgets</h2>
            </div>
            {budgets.length > 0 && <span className="muted-label">{money.format(budgetTotals.spent)} / {money.format(budgetTotals.planned)}</span>}
          </div>

          <form className="inline-form budget-form" onSubmit={saveBudget}>
            <select value={budgetForm.category_id} onChange={event => setBudgetForm(current => ({ ...current, category_id: event.target.value }))}>
              <option value="">Expense category</option>
              {expenseCategories.map(category => <option value={category.id} key={category.id}>{category.name}</option>)}
            </select>
            <input type="number" min="0.01" step="0.01" placeholder="Budget amount" value={budgetForm.amount} onChange={event => setBudgetForm(current => ({ ...current, amount: event.target.value }))} />
            <button className="primary-button compact-button" type="submit">Save</button>
          </form>

          {budgets.length === 0 ? <p className="empty-state compact">No budgets for {month}. Add one above.</p> : (
            <div className="budget-list">
              {budgets.map(budget => {
                const percent = budget.amount > 0 ? (budget.spent / budget.amount) * 100 : 0
                const over = percent > 100
                return (
                  <div className="budget-item" key={budget.id}>
                    <div className="budget-topline">
                      <div><strong>{budget.category_name}</strong><span>{money.format(budget.spent)} of {money.format(budget.amount)}</span></div>
                      <button className="text-button danger-text" type="button" onClick={() => deleteBudget(budget.id)}>Remove</button>
                    </div>
                    <div className="progress-track"><div className={`progress-fill ${over ? "over" : "budget"}`} style={{ width: `${Math.min(percent, 100)}%` }} /></div>
                    <small className={over ? "over-text" : "muted-label"}>{over ? `${money.format(Math.abs(budget.remaining))} over budget` : `${money.format(budget.remaining)} remaining`}</small>
                  </div>
                )
              })}
            </div>
          )}
        </article>

        <article className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Future</p>
              <h2>Savings goals</h2>
            </div>
          </div>

          <form className="goal-form" onSubmit={createGoal}>
            <input placeholder="Goal name" maxLength="120" value={goalForm.name} onChange={event => setGoalForm(current => ({ ...current, name: event.target.value }))} />
            <div className="form-row">
              <input type="number" min="0.01" step="0.01" placeholder="Target amount" value={goalForm.target_amount} onChange={event => setGoalForm(current => ({ ...current, target_amount: event.target.value }))} />
              <input type="number" min="0" step="0.01" placeholder="Already saved" value={goalForm.saved_amount} onChange={event => setGoalForm(current => ({ ...current, saved_amount: event.target.value }))} />
            </div>
            <div className="form-row">
              <input type="date" value={goalForm.target_date} onChange={event => setGoalForm(current => ({ ...current, target_date: event.target.value }))} />
              <button className="primary-button" type="submit">Create goal</button>
            </div>
          </form>

          {goals.length === 0 ? <p className="empty-state compact">No savings goals yet.</p> : (
            <div className="goal-list">
              {goals.map(goal => {
                const percent = goal.target_amount > 0 ? (goal.saved_amount / goal.target_amount) * 100 : 0
                return (
                  <div className="goal-item" key={goal.id}>
                    <div className="goal-heading">
                      <div><strong>{goal.name}</strong><span>{money.format(goal.saved_amount)} / {money.format(goal.target_amount)}</span></div>
                      <button className="text-button danger-text" type="button" onClick={() => deleteGoal(goal.id)}>Delete</button>
                    </div>
                    <div className="progress-track"><div className="progress-fill goal" style={{ width: `${Math.min(percent, 100)}%` }} /></div>
                    <div className="goal-meta"><span>{Math.min(percent, 999).toFixed(1)}%</span><span>{goal.target_date ? `Target ${goal.target_date}` : "No target date"}</span></div>
                    <div className="goal-contribution">
                      <input type="number" min="0.01" step="0.01" placeholder="Add funds" value={goalContributions[goal.id] || ""} onChange={event => setGoalContributions(current => ({ ...current, [goal.id]: event.target.value }))} />
                      <button className="secondary-button" type="button" onClick={() => addToGoal(goal)}>Add</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </article>
      </section>
    </section>
  )
}

export default DashboardOverview
