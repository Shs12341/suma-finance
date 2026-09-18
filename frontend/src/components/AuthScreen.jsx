import { useState } from "react"
import { apiFetch } from "../services/api"
import Icon from "./Icon"

const initialForm = {
  name: "",
  email: "",
  password: ""
}

function AuthScreen({ onAuthenticated, initialError = "" }) {
  const [mode, setMode] = useState("login")
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState(initialError)
  const [submitting, setSubmitting] = useState(false)

  function updateField(event) {
    const { name, value } = event.target
    setForm(current => ({ ...current, [name]: value }))
  }

  function switchMode(nextMode) {
    setMode(nextMode)
    setError("")
    setForm(initialForm)
  }

  async function submit(event) {
    event.preventDefault()

    try {
      setSubmitting(true)
      setError("")

      const payload = await apiFetch(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(
          mode === "register"
            ? form
            : { email: form.email, password: form.password }
        )
      })

      onAuthenticated(payload.user)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-layout">
        <div className="auth-showcase">
          <div className="auth-brand">
            <div className="brand-mark light">S</div>
            <div><strong>Suma</strong><span>Personal ledger</span></div>
          </div>

          <div className="auth-intro">
            <p className="auth-kicker">Your money, in one place.</p>
            <h1>A ledger you can actually read.</h1>
            <p className="auth-copy">
              Track activity, set monthly limits and keep savings goals visible without turning your finances into a dashboard circus.
            </p>
          </div>

          <div className="statement-preview" aria-hidden="true">
            <div className="statement-head">
              <div>
                <span>September balance</span>
                <strong>$4,820.40</strong>
              </div>
              <span className="statement-period">SEP 2026</span>
            </div>
            <div className="statement-summary">
              <span><small>IN</small><strong>+$2,480.00</strong></span>
              <span><small>OUT</small><strong>−$1,120.35</strong></span>
              <span><small>KEPT</small><strong>54.8%</strong></span>
            </div>
            <div className="statement-lines">
              <div><span>17 Sep</span><strong>Freelance payment</strong><b className="positive">+$680.00</b></div>
              <div><span>16 Sep</span><strong>Supermarket</strong><b>−$62.40</b></div>
              <div><span>14 Sep</span><strong>Internet</strong><b>−$40.00</b></div>
            </div>
          </div>

          <p className="auth-footnote">Secure sessions · PostgreSQL-backed · built for clear financial decisions</p>
        </div>

        <div className="auth-form-side">
          <article className="auth-card">
            <div className="auth-card-heading">
              <span className="auth-mode-label">{mode === "login" ? "SIGN IN" : "NEW ACCOUNT"}</span>
              <h2>{mode === "login" ? "Welcome back" : "Create your ledger"}</h2>
              <p>{mode === "login" ? "Continue where you left off." : "Start with a private account and your own categories."}</p>
            </div>

            <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
              <button type="button" className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>Log in</button>
              <button type="button" className={mode === "register" ? "active" : ""} onClick={() => switchMode("register")}>Create account</button>
            </div>

            <form className="auth-form" onSubmit={submit}>
              {mode === "register" && (
                <label>
                  <span>Full name</span>
                  <input name="name" value={form.name} onChange={updateField} autoComplete="name" placeholder="Diego Crespo" maxLength="100" required />
                </label>
              )}

              <label>
                <span>Email</span>
                <input name="email" type="email" value={form.email} onChange={updateField} autoComplete="email" placeholder="you@example.com" maxLength="150" required />
              </label>

              <label>
                <span>Password</span>
                <input name="password" type="password" value={form.password} onChange={updateField} autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder="Minimum 8 characters" minLength="8" maxLength="72" required />
              </label>

              <button className="primary-button auth-submit" type="submit" disabled={submitting}>
                {submitting ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
                {!submitting && <Icon name="chevron" size={15} />}
              </button>
            </form>

            {error && <p className="error-message">{error}</p>}

            <p className="auth-security-note"><Icon name="lock" size={14} /> Passwords are hashed. Sessions are revocable.</p>
          </article>
        </div>
      </section>
    </main>
  )
}

export default AuthScreen
