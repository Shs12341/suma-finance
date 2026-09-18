import { useCallback, useEffect, useState } from "react"
import { ApiError, apiFetch } from "../services/api"
import DashboardOverview from "./DashboardOverview"
import TransactionManager from "./TransactionManager"
import CategoryManager from "./CategoryManager"
import SecurityPanel from "./SecurityPanel"
import Icon from "./Icon"

const navigation = [
  { id: "overview", label: "Overview", icon: "overview", description: "Dashboard & planning" },
  { id: "transactions", label: "Transactions", icon: "transactions", description: "Income & expenses" },
  { id: "categories", label: "Categories", icon: "categories", description: "Organize your money" },
  { id: "security", label: "Security", icon: "security", description: "Sessions & access" }
]

const pageMeta = {
  overview: { eyebrow: "Financial workspace", title: "Overview", copy: "A clear view of your money, goals and monthly plan." },
  transactions: { eyebrow: "Money movement", title: "Transactions", copy: "Track every income and expense in one place." },
  categories: { eyebrow: "Organization", title: "Categories", copy: "Build a structure that matches the way you spend." },
  security: { eyebrow: "Account protection", title: "Security", copy: "Review active sessions and keep your account protected." }
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
          <div className="brand-mark">F</div>
          <div>
            <strong>Finance</strong>
            <span>Personal workspace</span>
          </div>
        </div>

        <div className="sidebar-section-label">Workspace</div>
        <nav className="sidebar-nav" aria-label="Finance sections">
          {navigation.map(item => (
            <button
              key={item.id}
              className={activeView === item.id ? "active" : ""}
              type="button"
              onClick={() => setActiveView(item.id)}
            >
              <span className="nav-icon"><Icon name={item.icon} size={19} /></span>
              <span className="nav-copy">
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
              <Icon name="chevron" size={15} className="nav-chevron" />
            </button>
          ))}
        </nav>

        <div className="sidebar-promo">
          <div className="promo-icon"><Icon name="sparkles" size={18} /></div>
          <strong>Portfolio build</strong>
          <p>Secure full-stack finance tracker with real PostgreSQL data.</p>
          <span>v1 · Local</span>
        </div>

        <div className="sidebar-account">
          <div className="avatar">{initials(user.name)}</div>
          <div className="sidebar-account-copy">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <button className="icon-button logout-icon" type="button" onClick={onLogout} aria-label="Log out" title="Log out">
            <Icon name="logout" size={18} />
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="page-title-block">
            <p className="eyebrow">{meta.eyebrow}</p>
            <h1>{meta.title}</h1>
            <p>{meta.copy}</p>
          </div>

          <div className="topbar-actions">
            <div className="sync-pill"><span className="sync-dot" />Live data</div>
            <div className="topbar-user">
              <div className="avatar small">{initials(user.name)}</div>
              <div>
                <strong>{user.name.split(" ")[0]}</strong>
                <span>Personal account</span>
              </div>
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
