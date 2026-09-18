import { useCallback, useEffect, useState } from "react"
import { ApiError, apiFetch } from "../services/api"
import Icon from "./Icon"

function formatDate(value) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value))
}

function shortAgent(value) {
  if (!value) return "Unknown client"
  return value.length > 90 ? `${value.slice(0, 87)}...` : value
}

function SecurityPanel({ onSessionExpired, onAllSessionsRevoked }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState(null)

  const handleError = useCallback((requestError) => {
    if (requestError instanceof ApiError && requestError.status === 401) {
      onSessionExpired()
      return
    }
    setError(requestError.message)
  }, [onSessionExpired])

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true)
      setError("")
      const payload = await apiFetch("/auth/sessions")
      setSessions(payload.sessions)
    } catch (requestError) {
      handleError(requestError)
    } finally {
      setLoading(false)
    }
  }, [handleError])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSessions()
  }, [loadSessions])

  async function revokeSession(session) {
    try {
      setBusyId(session.id)
      setError("")
      const result = await apiFetch(`/auth/sessions/${session.id}`, { method: "DELETE" })
      if (result.current_session) {
        onAllSessionsRevoked("This session was closed.")
        return
      }
      await loadSessions()
    } catch (requestError) {
      handleError(requestError)
    } finally {
      setBusyId(null)
    }
  }

  async function logoutEverywhere() {
    if (!window.confirm("Log out every active session for this account?")) return

    try {
      setBusyId("all")
      setError("")
      await apiFetch("/auth/logout-all", { method: "POST" })
      onAllSessionsRevoked("All sessions were closed successfully.")
    } catch (requestError) {
      handleError(requestError)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="security-layout">
      <article className="panel security-summary-panel">
        <div className="security-hero-icon"><Icon name="security" size={23} /></div>
        <p className="eyebrow">Account security</p>
        <h2>Active sessions</h2>
        <p className="security-copy">
          Sessions are stored server-side and can be revoked immediately. Logging out now invalidates the issued token instead of only removing the browser cookie.
        </p>
        <button className="secondary-button danger-outline" type="button" disabled={busyId === "all"} onClick={logoutEverywhere}>
          {busyId === "all" ? "Closing sessions..." : "Log out all sessions"}
        </button>
        {error && <p className="error-message">{error}</p>}
      </article>

      <article className="panel">
        <div className="section-heading">
          <div><p className="eyebrow">Session control</p><h2>Signed-in clients</h2></div>
          <span className="count-badge">{sessions.length}</span>
        </div>

        {loading ? <p className="empty-state">Loading sessions...</p> : sessions.length === 0 ? (
          <p className="empty-state">No active sessions found.</p>
        ) : (
          <div className="session-list">
            {sessions.map(session => (
              <div className="session-row" key={session.id}>
                <div className="session-device"><Icon name="device" size={18} /></div>
                <div className="session-copy">
                  <div className="session-title-row">
                    <strong>{session.current ? "Current session" : "Other session"}</strong>
                    {session.current && <span className="session-current">Current</span>}
                  </div>
                  <span>{shortAgent(session.user_agent)}</span>
                  <small>IP {session.ip_address || "unknown"} · Last seen {formatDate(session.last_seen_at)} · Expires {formatDate(session.expires_at)}</small>
                </div>
                {!session.current && (
                  <button className="text-button danger-text" type="button" disabled={busyId === session.id} onClick={() => revokeSession(session)}>
                    {busyId === session.id ? "Closing..." : "Revoke"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  )
}

export default SecurityPanel
