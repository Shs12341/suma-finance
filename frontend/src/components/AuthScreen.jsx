import { useState } from "react"
import { apiFetch } from "../services/api"

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
        <div className="auth-intro">
          <p className="eyebrow">Personal finance · portfolio v1</p>
          <h1>Know where your money is going.</h1>
          <p className="auth-copy">
            A full-stack finance tracker with private accounts, PostgreSQL persistence,
            categories and transaction history.
          </p>

          <div className="auth-feature-row" aria-label="Application features">
            <span>Private account</span>
            <span>Real database</span>
            <span>Secure session</span>
          </div>
        </div>

        <article className="auth-card">
          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => switchMode("login")}
            >
              Log in
            </button>
            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => switchMode("register")}
            >
              Create account
            </button>
          </div>

          <div className="auth-card-heading">
            <p className="eyebrow">{mode === "login" ? "Welcome back" : "Get started"}</p>
            <h2>{mode === "login" ? "Log in to your account" : "Create your account"}</h2>
          </div>

          <form className="auth-form" onSubmit={submit}>
            {mode === "register" && (
              <label>
                Name
                <input
                  name="name"
                  value={form.name}
                  onChange={updateField}
                  autoComplete="name"
                  placeholder="Your name"
                  maxLength="100"
                  required
                />
              </label>
            )}

            <label>
              Email
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={updateField}
                autoComplete="email"
                placeholder="you@example.com"
                maxLength="150"
                required
              />
            </label>

            <label>
              Password
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={updateField}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                placeholder="Minimum 8 characters"
                minLength="8"
                maxLength="72"
                required
              />
            </label>

            <button className="primary-button" type="submit" disabled={submitting}>
              {submitting
                ? "Please wait..."
                : mode === "login"
                  ? "Log in"
                  : "Create account"}
            </button>
          </form>

          {error && <p className="error-message">{error}</p>}

          <p className="auth-footnote">
            Your session is stored in an HttpOnly cookie; the browser does not expose
            the token to the React app.
          </p>
        </article>
      </section>
    </main>
  )
}

export default AuthScreen
