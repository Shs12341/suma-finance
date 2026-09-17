export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api"

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  })

  let payload = null

  if (response.status !== 204) {
    const contentType = response.headers.get("content-type") || ""

    if (contentType.includes("application/json")) {
      payload = await response.json()
    }
  }

  if (!response.ok) {
    throw new ApiError(payload?.error || "La solicitud no pudo completarse", response.status)
  }

  return payload
}
