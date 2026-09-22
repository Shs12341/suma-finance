import { useCallback, useEffect, useMemo, useState } from "react"
import { ApiError, apiFetch } from "../services/api"
import Icon from "./Icon"

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
const currentMonth = new Date().toISOString().slice(0, 7)

function monthLabel(value, long = false) {
  if (!/^\d{4}-\d{2}$/.test(value || "")) return "Current month"
  const [year, month] = value.split("-")
  return new Intl.DateTimeFormat("en-US", {
    month: long ? "long" : "short",
    year: long ? "numeric" : "2-digit",
    timeZone: "UTC"
  }).format(new Date(`${year}-${month}-01T00:00:00Z`))
}

function shiftMonth(value, amount) {
  const safeValue = /^\d{4}-\d{2}$/.test(value || "") ? value : currentMonth
  const [year, month] = safeValue.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1 + amount, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

function shortDate(value) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    .format(new Date(`${value.slice(0, 10)}T00:00:00Z`))
}

function safePercent(value) {
  return Number.isFinite(value) ? value : null
}

function DashboardOverview({ categories, refreshKey, onDataChanged, onSessionExpired }) {
  const [month, setMonth] = useState(currentMonth)
  const [analytics, setAnalytics] = useState(null)
  const [budgets, setBudgets] = useState([])
  const [goals, setGoals] = useState([])
  const [recentTransactions, setRecentTransactions] = useState([])
  const [budgetForm, setBudgetForm] = useState({ category_id: "", amount: "" })
  const [goalForm, setGoalForm] = useState({ name: "", target_amount: "", saved_amount: "", target_date: "" })
  const [goalContributions, setGoalContributions] = useState({})
  const [privacyMode, setPrivacyMode] = useState(false)
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
      const [analyticsData, budgetsData, goalsData, transactionsData] = await Promise.all([
        apiFetch(`/analytics?month=${month}&months=6`),
        apiFetch(`/budgets?month=${month}`),
        apiFetch("/goals"),
        apiFetch("/transactions?limit=6")
      ])
      setAnalytics(analyticsData)
      setBudgets(budgetsData)
      setGoals(goalsData)
      setRecentTransactions(transactionsData.items || [])
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

  const expenseTotal = useMemo(() => {
    return analytics?.expense_categories?.reduce((sum, item) => sum + item.amount, 0) || 0
  }, [analytics])

  const previousMonth = useMemo(() => {
    if (!analytics?.history?.length) return null
    const selectedIndex = analytics.history.findIndex(item => item.month === month)
    if (selectedIndex > 0) return analytics.history[selectedIndex - 1]
    return null
  }, [analytics, month])

  const summary = analytics?.summary || { income: 0, expenses: 0, balance: 0, savings_rate: null }
  const monthExpenseDelta = previousMonth && previousMonth.expenses > 0
    ? ((summary.expenses - previousMonth.expenses) / previousMonth.expenses) * 100
    : null

  const topExpenseCategory = analytics?.expense_categories?.[0] || null

  const moneyStory = useMemo(() => {
    if (summary.income === 0 && summary.expenses === 0) {
      return {
        headline: "This month is still quiet.",
        detail: "Once money starts moving, this page will turn your activity into a simple monthly story."
      }
    }

    const opening = `You brought in ${money.format(summary.income)} and recorded ${money.format(summary.expenses)} in expenses.`
    const categoryLine = topExpenseCategory
      ? `${topExpenseCategory.category_name} is your biggest spending category at ${money.format(topExpenseCategory.amount)}.`
      : "Your spending is still too light to show a clear category pattern."

    let comparison = "There isn’t enough history yet for a month-to-month comparison."
    if (monthExpenseDelta != null) {
      const direction = monthExpenseDelta > 0 ? "up" : "down"
      comparison = `Spending is ${direction} ${Math.abs(monthExpenseDelta).toFixed(0)}% from the previous month.`
    }

    return { headline: opening, detail: `${categoryLine} ${comparison}` }
  }, [summary.income, summary.expenses, topExpenseCategory, monthExpenseDelta])

  const postIt = useMemo(() => {
    const rate = safePercent(summary.savings_rate)
    if (rate != null && rate >= 0) {
      return {
        label: "Keep in mind",
        text: `You kept ${rate.toFixed(0)}% of this month’s income after recorded expenses.`
      }
    }

    if (summary.balance < 0) {
      return {
        label: "Keep in mind",
        text: `Recorded expenses are ${money.format(Math.abs(summary.balance))} ahead of income this month.`
      }
    }

    return {
      label: "Keep in mind",
      text: "Small, consistent entries make the monthly picture more useful."
    }
  }, [summary.savings_rate, summary.balance])

  const privateMoney = useCallback((value, options = {}) => {
    if (privacyMode) return "$••••"
    const formatted = money.format(value || 0)
    if (options.sign === "plus") return `+${formatted}`
    if (options.sign === "minus") return `−${formatted}`
    return formatted
  }, [privacyMode])

  async function saveBudget(event) {
    event.preventDefault()
    if (!budgetForm.category_id || !budgetForm.amount) {
      setError("Choose a category and amount for the budget.")
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
      setError("Add a name and target amount for the goal.")
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
      setError("Add an amount greater than zero.")
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

  return (
    <section className="overview-stack journal-overview">
      <header className="journal-toolbar">
        <div className="month-navigator" aria-label="Selected month">
          <button type="button" onClick={() => setMonth(current => shiftMonth(current, -1))} aria-label="Previous month">
            <span className="month-chevron previous"><Icon name="chevron" size={17} /></span>
          </button>
          <div>
            <span className="eyebrow">Monthly journal</span>
            <strong>{monthLabel(month, true)}</strong>
          </div>
          <button type="button" onClick={() => setMonth(current => shiftMonth(current, 1))} aria-label="Next month">
            <span className="month-chevron"><Icon name="chevron" size={17} /></span>
          </button>
        </div>

        <button
          type="button"
          className={`privacy-toggle ${privacyMode ? "active" : ""}`}
          onClick={() => setPrivacyMode(current => !current)}
          aria-pressed={privacyMode}
        >
          <span className="privacy-eye">◉</span>
          <span>Privacy mode</span>
          <i aria-hidden="true"><b /></i>
        </button>
      </header>

      {error && <p className="error-message">{error}</p>}

      <section className="journal-hero-grid">
        <article className="journal-balance-card">
          <span className="eyebrow">Available to spend</span>
          <strong className="journal-balance">{privateMoney(summary.balance)}</strong>
          <div className="journal-balance-rule" />
          <div className="journal-balance-meta">
            <div><span>Income</span><strong className="metric-positive">{privateMoney(summary.income)}</strong></div>
            <div><span>Expenses</span><strong className="metric-negative">{privateMoney(summary.expenses)}</strong></div>
          </div>
          <p className="journal-balance-note">
            {summary.savings_rate == null
              ? "Your monthly picture will get clearer as you add activity."
              : summary.savings_rate >= 0
                ? `You kept ${summary.savings_rate.toFixed(1)}% of what came in.`
                : "Expenses are currently ahead of income."}
          </p>
        </article>

        <article className="journal-flow-card">
          <div className="journal-card-heading">
            <div>
              <span className="eyebrow">Last six months</span>
              <h2>Monthly flow</h2>
            </div>
            <div className="journal-legend"><span><i className="legend-dot income" />Income</span><span><i className="legend-dot expense" />Expenses</span></div>
          </div>

          {loading ? <p className="empty-state">Loading cash flow…</p> : (
            <div className="bar-chart journal-chart" aria-label="Income and expenses by month">
              {analytics?.history?.map(item => (
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
        </article>

        <aside className="money-story-card">
          <span className="eyebrow">Money story</span>
          <h2>{monthLabel(month, true)}</h2>
          <p>{privacyMode ? "Your monthly story is hidden while Privacy Mode is on." : moneyStory.headline}</p>
          {!privacyMode && <p className="money-story-detail">{moneyStory.detail}</p>}
          <div className="money-story-footer">
            <span>{topExpenseCategory ? "Biggest category" : "Monthly note"}</span>
            <strong>{privacyMode ? "Hidden" : topExpenseCategory?.category_name || "Building history"}</strong>
          </div>
        </aside>
      </section>

      <section className="journal-middle-grid">
        <article className="journal-section recent-journal-section">
          <div className="journal-section-heading">
            <div><span className="eyebrow">Latest</span><h2>Recent activity</h2></div>
            <span className="journal-section-note">A clean record of what moved.</span>
          </div>

          {recentTransactions.length === 0 ? <p className="empty-state compact">Nothing has moved yet. Your latest activity will show up here.</p> : (
            <div className="recent-ledger journal-ledger">
              {recentTransactions.map(transaction => (
                <div className="recent-ledger-row" key={transaction.id}>
                  <span className="recent-date">{shortDate(transaction.transaction_date)}</span>
                  <strong>{transaction.description}</strong>
                  <span>{transaction.category_name || "Uncategorized"}</span>
                  <b className={transaction.type === "income" ? "metric-positive" : "metric-negative"}>
                    {privateMoney(transaction.amount, { sign: transaction.type === "income" ? "plus" : "minus" })}
                  </b>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="journal-section spending-journal-section">
          <div className="journal-section-heading">
            <div><span className="eyebrow">Spending</span><h2>Where your money went</h2></div>
            <span className="muted-label">{privacyMode ? "$••••" : money.format(expenseTotal)} total</span>
          </div>

          {analytics?.expense_categories?.length ? (
            <div className="spending-table journal-spending-table">
              {analytics.expense_categories.map(item => {
                const share = expenseTotal > 0 ? (item.amount / expenseTotal) * 100 : 0
                return (
                  <div className="spending-row" key={item.category_name}>
                    <strong>{item.category_name}</strong>
                    <div className="spending-line"><span style={{ width: `${Math.max(2, share)}%` }} /></div>
                    <span>{share.toFixed(0)}%</span>
                    <b>{privacyMode ? "$••••" : money.format(item.amount)}</b>
                  </div>
                )
              })}
            </div>
          ) : <p className="empty-state compact">No spending recorded for this month.</p>}
        </article>
      </section>

      <section className="journal-planning-grid">
        <article className="journal-section goals-journal-section">
          <div className="journal-section-heading">
            <div><span className="eyebrow">Saving</span><h2>Goals</h2></div>
            <span className="muted-label">{goals.length} active</span>
          </div>

          {goals.length === 0 ? <p className="empty-state compact">No savings goals yet.</p> : (
            <div className="goal-list journal-goals">
              {goals.slice(0, 4).map(goal => {
                const percent = goal.target_amount > 0 ? (goal.saved_amount / goal.target_amount) * 100 : 0
                return (
                  <div className="goal-item journal-goal" key={goal.id}>
                    <div className="goal-heading">
                      <div><strong>{goal.name}</strong><span>{privacyMode ? "$•••• / $••••" : `${money.format(goal.saved_amount)} of ${money.format(goal.target_amount)}`}</span></div>
                      <b>{Math.min(percent, 999).toFixed(0)}%</b>
                    </div>
                    <div className="progress-track"><div className="progress-fill goal" style={{ width: `${Math.min(percent, 100)}%` }} /></div>
                    <div className="goal-actions-line">
                      <input type="number" min="0.01" step="0.01" placeholder="Add funds" value={goalContributions[goal.id] || ""} onChange={event => setGoalContributions(current => ({ ...current, [goal.id]: event.target.value }))} />
                      <button className="text-button" type="button" onClick={() => addToGoal(goal)}>Add</button>
                      <button className="text-button danger-text" type="button" onClick={() => deleteGoal(goal.id)}>Delete</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <details className="inline-disclosure journal-disclosure">
            <summary><Icon name="plus" size={14} /> Create a goal</summary>
            <form className="goal-form compact-goal-form" onSubmit={createGoal}>
              <input placeholder="Goal name" maxLength="120" value={goalForm.name} onChange={event => setGoalForm(current => ({ ...current, name: event.target.value }))} />
              <div className="form-row">
                <input type="number" min="0.01" step="0.01" placeholder="Target amount" value={goalForm.target_amount} onChange={event => setGoalForm(current => ({ ...current, target_amount: event.target.value }))} />
                <input type="number" min="0" step="0.01" placeholder="Already saved" value={goalForm.saved_amount} onChange={event => setGoalForm(current => ({ ...current, saved_amount: event.target.value }))} />
              </div>
              <div className="form-row">
                <input type="date" value={goalForm.target_date} onChange={event => setGoalForm(current => ({ ...current, target_date: event.target.value }))} />
                <button className="primary-button" type="submit">Create</button>
              </div>
            </form>
          </details>
        </article>

        <aside className="journal-postit" aria-label="Monthly note">
          <span>{postIt.label}</span>
          <strong>{privacyMode ? "Amounts are hidden while Privacy Mode is on." : postIt.text}</strong>
          <i aria-hidden="true" />
        </aside>

        <article className="journal-section budget-journal-section">
          <div className="journal-section-heading">
            <div><span className="eyebrow">Planning</span><h2>Budget pulse</h2></div>
            {budgets.length > 0 && <strong className="budget-total">{privacyMode ? "$•••• left" : `${money.format(budgetTotals.remaining)} left`}</strong>}
          </div>

          {budgets.length === 0 ? (
            <p className="empty-state compact">No budgets yet. Add one when you want a gentle spending limit.</p>
          ) : (
            <div className="budget-list compact-budget-list journal-budget-list">
              {budgets.slice(0, 5).map(budget => {
                const percent = budget.amount > 0 ? (budget.spent / budget.amount) * 100 : 0
                const over = percent > 100
                return (
                  <div className="budget-item compact-budget" key={budget.id}>
                    <div className="budget-topline">
                      <div><strong>{budget.category_name}</strong><span>{privacyMode ? "$•••• / $••••" : `${money.format(budget.spent)} / ${money.format(budget.amount)}`}</span></div>
                      <span className={over ? "budget-status over-text" : "budget-status"}>{Math.round(percent)}%</span>
                    </div>
                    <div className="progress-track"><div className={`progress-fill ${over ? "over" : "budget"}`} style={{ width: `${Math.min(percent, 100)}%` }} /></div>
                    <button className="text-button journal-delete-budget" type="button" onClick={() => deleteBudget(budget.id)}>Remove</button>
                  </div>
                )
              })}
            </div>
          )}

          <details className="inline-disclosure journal-disclosure">
            <summary><Icon name="plus" size={14} /> Add a monthly budget</summary>
            <form className="inline-form budget-form" onSubmit={saveBudget}>
              <select value={budgetForm.category_id} onChange={event => setBudgetForm(current => ({ ...current, category_id: event.target.value }))}>
                <option value="">Expense category</option>
                {expenseCategories.map(category => <option value={category.id} key={category.id}>{category.name}</option>)}
              </select>
              <input type="number" min="0.01" step="0.01" placeholder="Amount" value={budgetForm.amount} onChange={event => setBudgetForm(current => ({ ...current, amount: event.target.value }))} />
              <button className="primary-button compact-button" type="submit">Save</button>
            </form>
          </details>
        </article>
      </section>
    </section>
  )
}

export default DashboardOverview
