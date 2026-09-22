import { useCallback, useEffect, useState } from "react"
import { ApiError, apiFetch } from "../services/api"
import ConfirmDialog from "./ConfirmDialog"
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
  const [confirmAll, setConfirmAll] = useState(false)
  const [revokeTarget, setRevokeTarget] = useState(null)

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
      setRevokeTarget(null)
      await loadSessions()
    } catch (requestError) {
      handleError(requestError)
    } finally {
      setBusyId(null)
    }
  }

  async function logoutEverywhere() {
    try {
      setBusyId("all")
      setError("")
      await apiFetch("/auth/logout-all", { method: "POST" })
      setConfirmAll(false)
      onAllSessionsRevoked("All sessions were closed successfully.")
    } catch (requestError) {
      handleError(requestError)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <section className="security-layout journal-page">
        <article className="panel security-summary-panel friendly-security-summary">
          <div className="security-hero-icon"><Icon name="security" size={22} /></div>
          <span className="eyebrow">Account access</span>
          <h2>You’re in control</h2>
          <p className="security-copy">
            See every browser signed into your account and close access instantly if something doesn’t look familiar.
          </p>
          <div className="security-tip">
            <Icon name="lock" size={15} />
            <span>Signing out here also invalidates the session on the server.</span>
          </div>
          <button className="secondary-button danger-outline" type="button" disabled={busyId === "all"} onClick={() => setConfirmAll(true)}>
            Log out everywhere
          </button>
          {error && <p className="error-message">{error}</p>}
        </article>

        <article className="panel sessions-panel">
          <div className="section-heading friendly-heading">
            <div><span className="eyebrow">Signed-in devices</span><h2>Active sessions</h2><p>{sessions.length === 1 ? "Only this device is signed in." : `${sessions.length} sessions currently have access.`}</p></div>
            <span className="count-badge">{sessions.length}</span>
          </div>

          {loading ? <p className="empty-state">Checking your sessions...</p> : sessions.length === 0 ? (
            <p className="empty-state">No active sessions found.</p>
          ) : (
            <div className="session-list">
              {sessions.map(session => (
                <div className={`session-row ${session.current ? "current-row" : ""}`} key={session.id}>
                  <div className="session-device"><Icon name="device" size={18} /></div>
                  <div className="session-copy">
                    <div className="session-title-row">
                      <strong>{session.current ? "This device" : "Another signed-in device"}</strong>
                      {session.current && <span className="session-current">You’re here</span>}
                    </div>
                    <span>{shortAgent(session.user_agent)}</span>
                    <small>IP {session.ip_address || "unknown"} · Last used {formatDate(session.last_seen_at)} · Expires {formatDate(session.expires_at)}</small>
                  </div>
                  {!session.current && (
                    <button className="text-button danger-text" type="button" disabled={busyId === session.id} onClick={() => setRevokeTarget(session)}>
                      {busyId === session.id ? "Closing..." : "Log out"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <ConfirmDialog
        open={confirmAll}
        title="Log out everywhere?"
        message="Every active session will be closed, including this one. You’ll need to sign in again on any device you want to keep using."
        confirmLabel="Log out all sessions"
        tone="danger"
        busy={busyId === "all"}
        onCancel={() => setConfirmAll(false)}
        onConfirm={logoutEverywhere}
      />

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title="Log out this device?"
        message="That session will lose access immediately. Your current session will stay open."
        confirmLabel="Log out device"
        tone="danger"
        busy={Boolean(revokeTarget && busyId === revokeTarget.id)}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={() => revokeTarget && revokeSession(revokeTarget)}
      />
    </>
  )
}

export default SecurityPanel
