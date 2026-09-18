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
            <div className="brand-mark light">F</div>
            <div><strong>Finance</strong><span>Money, made clear.</span></div>
          </div>

          <div className="auth-intro">
            <span className="auth-kicker"><Icon name="sparkles" size={15} /> Secure personal finance</span>
            <h1>Take control of your money without the noise.</h1>
            <p className="auth-copy">
              Track spending, build budgets and grow savings goals inside one private, beautifully organized workspace.
            </p>
          </div>

          <div className="auth-preview" aria-hidden="true">
            <div className="preview-glow" />
            <div className="preview-card preview-balance">
              <div className="preview-card-top"><span>Available balance</span><span className="preview-chip">This month</span></div>
              <strong>$4,820.40</strong>
              <div className="preview-stats"><span>Income <b>+$2,480</b></span><span>Expenses <b>−$1,120</b></span></div>
            </div>
            <div className="preview-card preview-activity">
              <div className="preview-row"><span className="preview-dot green" /><div><b>Freelance payment</b><small>Income</small></div><strong>+$680</strong></div>
              <div className="preview-row"><span className="preview-dot coral" /><div><b>Groceries</b><small>Food</small></div><strong>−$62</strong></div>
            </div>
          </div>

          <div className="auth-trust-row">
            <span><Icon name="lock" size={15} /> HttpOnly sessions</span>
            <span><Icon name="security" size={15} /> Revocable access</span>
            <span><Icon name="wallet" size={15} /> PostgreSQL data</span>
          </div>
        </div>

        <div className="auth-form-side">
          <article className="auth-card">
            <div className="auth-card-heading">
              <p className="eyebrow">{mode === "login" ? "Welcome back" : "Start your workspace"}</p>
              <h2>{mode === "login" ? "Log in to Finance" : "Create your account"}</h2>
              <p>{mode === "login" ? "Your financial workspace is ready when you are." : "Set up a private account in less than a minute."}</p>
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
                <span>Email address</span>
                <input name="email" type="email" value={form.email} onChange={updateField} autoComplete="email" placeholder="you@example.com" maxLength="150" required />
              </label>

              <label>
                <span>Password</span>
                <input name="password" type="password" value={form.password} onChange={updateField} autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder="Minimum 8 characters" minLength="8" maxLength="72" required />
              </label>

              <button className="primary-button auth-submit" type="submit" disabled={submitting}>
                {submitting ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
                {!submitting && <Icon name="chevron" size={16} />}
              </button>
            </form>

            {error && <p className="error-message">{error}</p>}

            <div className="auth-security-note"><Icon name="lock" size={15} /><span>Your password is hashed and your session token stays out of React.</span></div>
          </article>
        </div>
      </section>
    </main>
  )
}

export default AuthScreen
