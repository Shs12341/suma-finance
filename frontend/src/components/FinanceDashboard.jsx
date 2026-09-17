import { useCallback, useEffect, useState } from "react"
import { ApiError, apiFetch } from "../services/api"
import DashboardOverview from "./DashboardOverview"
import TransactionManager from "./TransactionManager"
import CategoryManager from "./CategoryManager"

function FinanceDashboard({ user, onLogout, onSessionExpired }) {
  const [activeView, setActiveView] = useState("overview")
  const [categories, setCategories] = useState([])
  const [dataVersion, setDataVersion] = useState(0)
  const [globalError, setGlobalError] = useState("")

  const handleRequestError = useCallback((requestError) => {
    if (requestError instanceof ApiError && requestError.status === 401) {
      onSessionExpired()
      return
    }

    setGlobalError(requestError.message)
  }, [onSessionExpired])

  const loadCategories = useCallback(async () => {
    try {
      setGlobalError("")
      const data = await apiFetch("/categories")
      setCategories(data)
    } catch (requestError) {
      handleRequestError(requestError)
    }
  }, [handleRequestError])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  function markDataChanged() {
    setDataVersion(current => current + 1)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Personal finance</p>
          <h1>Finance App</h1>
        </div>

        <div className="account-area">
          <div className="account-copy">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <button className="secondary-button" type="button" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <nav className="app-nav" aria-label="Finance sections">
        <button
          className={activeView === "overview" ? "active" : ""}
          type="button"
          onClick={() => setActiveView("overview")}
        >
          Overview
        </button>
        <button
          className={activeView === "transactions" ? "active" : ""}
          type="button"
          onClick={() => setActiveView("transactions")}
        >
          Transactions
        </button>
        <button
          className={activeView === "categories" ? "active" : ""}
          type="button"
          onClick={() => setActiveView("categories")}
        >
          Categories
        </button>
      </nav>

      {globalError && <p className="error-message global-error">{globalError}</p>}

      {activeView === "overview" && (
        <DashboardOverview
          categories={categories}
          refreshKey={dataVersion}
          onDataChanged={markDataChanged}
          onSessionExpired={onSessionExpired}
        />
      )}

      {activeView === "transactions" && (
        <TransactionManager
          categories={categories}
          onDataChanged={markDataChanged}
          onSessionExpired={onSessionExpired}
        />
      )}

      {activeView === "categories" && (
        <CategoryManager
          categories={categories}
          refreshCategories={loadCategories}
          onDataChanged={markDataChanged}
          onSessionExpired={onSessionExpired}
        />
      )}
    </main>
  )
}

export default FinanceDashboard
