import { useEffect, useState } from "react"
import "./App.css"
import AuthScreen from "./components/AuthScreen"
import FinanceDashboard from "./components/FinanceDashboard"
import { ApiError, apiFetch } from "./services/api"

function App() {
  const [user, setUser] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [authError, setAuthError] = useState("")

  useEffect(() => {
    async function restoreSession() {
      try {
        const payload = await apiFetch("/auth/me")
        setUser(payload.user)
      } catch (requestError) {
        if (!(requestError instanceof ApiError && requestError.status === 401)) {
          setAuthError("No se pudo conectar con el servidor")
        }
      } finally {
        setCheckingSession(false)
      }
    }

    restoreSession()
  }, [])

  async function logout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" })
    } catch {
      // Clear local UI state even if the backend is temporarily unavailable.
    } finally {
      setUser(null)
      setAuthError("")
    }
  }

  function sessionExpired() {
    setUser(null)
    setAuthError("Tu sesión expiró o fue revocada. Inicia sesión nuevamente.")
  }

  function allSessionsRevoked(message) {
    setUser(null)
    setAuthError(message || "Todas las sesiones fueron cerradas.")
  }

  if (checkingSession) {
    return (
      <main className="loading-screen">
        <div className="loading-mark">S</div>
        <p>Opening Suma...</p>
      </main>
    )
  }

  if (!user) {
    return (
      <AuthScreen
        initialError={authError}
        onAuthenticated={authenticatedUser => {
          setAuthError("")
          setUser(authenticatedUser)
        }}
      />
    )
  }

  return (
    <FinanceDashboard
      user={user}
      onLogout={logout}
      onSessionExpired={sessionExpired}
      onAllSessionsRevoked={allSessionsRevoked}
    />
  )
}

export default App
