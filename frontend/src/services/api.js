export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api"

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

let csrfToken = null
let csrfPromise = null

function isMutation(method) {
  return !["GET", "HEAD", "OPTIONS"].includes(String(method || "GET").toUpperCase())
}

function authBootstrapPath(path) {
  return path === "/auth/login" || path === "/auth/register"
}

async function getCsrfToken() {
  if (csrfToken) return csrfToken
  if (csrfPromise) return csrfPromise

  csrfPromise = fetch(`${API_URL}/auth/csrf`, {
    credentials: "include",
    headers: { Accept: "application/json" }
  })
    .then(async response => {
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new ApiError(payload?.error || "No se pudo validar la sesión", response.status)
      csrfToken = payload.csrf_token
      return csrfToken
    })
    .finally(() => {
      csrfPromise = null
    })

  return csrfPromise
}

export function clearSecurityState() {
  csrfToken = null
  csrfPromise = null
}

async function performRequest(path, options, retryCsrf) {
  const method = String(options.method || "GET").toUpperCase()
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...options.headers
  }

  if (isMutation(method) && !authBootstrapPath(path)) {
    headers["X-CSRF-Token"] = await getCsrfToken()
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    method,
    credentials: "include",
    headers
  })

  let payload = null
  if (response.status !== 204) {
    const contentType = response.headers.get("content-type") || ""
    if (contentType.includes("application/json")) payload = await response.json()
  }

  if (!response.ok) {
    if (response.status === 401) clearSecurityState()

    if (response.status === 403 && payload?.error === "Validación CSRF fallida" && retryCsrf) {
      clearSecurityState()
      return performRequest(path, options, false)
    }

    throw new ApiError(payload?.error || "La solicitud no pudo completarse", response.status)
  }

  if (path === "/auth/logout" || path === "/auth/logout-all") clearSecurityState()
  return payload
}

export async function apiFetch(path, options = {}) {
  return performRequest(path, options, true)
}
