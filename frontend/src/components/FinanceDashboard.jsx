import { useCallback, useEffect, useState } from "react"
import { ApiError, apiFetch } from "../services/api"
import DashboardOverview from "./DashboardOverview"
import TransactionManager from "./TransactionManager"
import CategoryManager from "./CategoryManager"
import SecurityPanel from "./SecurityPanel"
import Icon from "./Icon"

const navigation = [
  { id: "overview", label: "Overview", icon: "overview" },
  { id: "transactions", label: "Transactions", icon: "transactions" },
  { id: "categories", label: "Categories", icon: "categories" },
  { id: "security", label: "Security", icon: "security" }
]

const pageMeta = {
  overview: { title: "Overview", copy: "A clear monthly record of your money." },
  transactions: { title: "Transactions", copy: "Add something in seconds, find anything later." },
  categories: { title: "Categories", copy: "Keep your money organized in a way that feels natural." },
  security: { title: "Security", copy: "See where you’re signed in and stay in control." }
}

function initials(name = "User") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("") || "U"
}

function FinanceDashboard({ user, onLogout, onSessionExpired, onAllSessionsRevoked }) {
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCategories()
  }, [loadCategories])

  function markDataChanged() {
    setDataVersion(current => current + 1)
  }

  const meta = pageMeta[activeView]

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark journal-brand-mark"><span className="brand-leaf" /></div>
          <div>
            <strong>Suma</strong>
            <span>Your monthly money journal</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Suma sections">
          {navigation.map(item => (
            <button
              key={item.id}
              className={activeView === item.id ? "active" : ""}
              type="button"
              onClick={() => setActiveView(item.id)}
            >
              <span className="nav-icon"><Icon name={item.icon} size={18} /></span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer-note">
          <span className="status-dot" />
          <span>Private by design</span>
        </div>

        <div className="sidebar-account">
          <div className="avatar">{initials(user.name)}</div>
          <div className="sidebar-account-copy">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <button className="icon-button logout-icon" type="button" onClick={onLogout} aria-label="Log out" title="Log out">
            <Icon name="logout" size={17} />
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="page-title-block">
            <h1>{meta.title}</h1>
            <p>{meta.copy}</p>
          </div>

          <div className="topbar-actions">
            <span className="workspace-state"><span className="sync-dot" />Up to date</span>
            <div className="topbar-user">
              <div className="avatar small">{initials(user.name)}</div>
              <strong>{user.name.split(" ")[0]}</strong>
            </div>
          </div>
        </header>

        <section className="dashboard-content">
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

          {activeView === "security" && (
            <SecurityPanel
              onSessionExpired={onSessionExpired}
              onAllSessionsRevoked={onAllSessionsRevoked}
            />
          )}
        </section>
      </main>
    </div>
  )
}

export default FinanceDashboard
