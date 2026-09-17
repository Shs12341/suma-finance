const MONEY_MAX = 9999999999.99

function cleanString(value) {
  return String(value ?? "").trim()
}

function isRealDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const [year, month, day] = value.split("-").map(Number)
  if (year < 1900 || year > 2200) return false

  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
}

function isRealMonth(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return false
  const [year, month] = value.split("-").map(Number)
  return year >= 2000 && year <= 2200 && month >= 1 && month <= 12
}

function parseMoney(value, { allowZero = false, max = MONEY_MAX } = {}) {
  if (value === null || value === undefined || value === "") return null

  const raw = typeof value === "number" ? String(value) : String(value).trim()
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(raw)) return null

  const amount = Number(raw)
  if (!Number.isFinite(amount)) return null
  if (allowZero ? amount < 0 : amount <= 0) return null
  if (amount > max) return null

  return amount
}

function parsePositiveInt(value) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

function parseLimit(value, { fallback = 50, max = 100 } = {}) {
  if (value === undefined || value === null || value === "") return fallback
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1) return null
  return Math.min(number, max)
}

function parseOffset(value, { max = 100000 } = {}) {
  if (value === undefined || value === null || value === "") return 0
  const number = Number(value)
  if (!Number.isInteger(number) || number < 0 || number > max) return null
  return number
}

function hasOnlyKeys(object, allowedKeys) {
  if (!object || typeof object !== "object" || Array.isArray(object)) return false
  const allowed = new Set(allowedKeys)
  return Object.keys(object).every(key => allowed.has(key))
}

function validateAuthPayload(payload, requireName) {
  if (!hasOnlyKeys(payload, requireName ? ["name", "email", "password"] : ["email", "password"])) {
    return { error: "La solicitud contiene campos no permitidos" }
  }

  const name = cleanString(payload.name)
  const email = cleanString(payload.email).toLowerCase()
  const password = typeof payload.password === "string" ? payload.password : ""
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (requireName && (name.length < 2 || name.length > 100)) {
    return { error: "El nombre debe tener entre 2 y 100 caracteres" }
  }

  if (!emailPattern.test(email) || email.length > 150) {
    return { error: "Ingresa un correo válido" }
  }

  if (password.length < 8 || password.length > 72) {
    return { error: "La contraseña debe tener entre 8 y 72 caracteres" }
  }

  return { value: { name, email, password } }
}

function validateTransactionPayload(payload) {
  if (!hasOnlyKeys(payload, ["type", "description", "amount", "category_id", "transaction_date"])) {
    return { error: "La transacción contiene campos no permitidos" }
  }

  const type = payload.type
  const description = cleanString(payload.description)
  const amount = parseMoney(payload.amount)
  const categoryId = parsePositiveInt(payload.category_id)
  const transactionDate = payload.transaction_date

  if (!["income", "expense"].includes(type)) return { error: "Tipo de transacción inválido" }
  if (!description || description.length > 200) return { error: "La descripción debe tener entre 1 y 200 caracteres" }
  if (amount === null) return { error: "El monto debe ser positivo, tener máximo 2 decimales y no exceder 9,999,999,999.99" }
  if (!categoryId) return { error: "Selecciona una categoría válida" }
  if (!isRealDate(transactionDate)) return { error: "Ingresa una fecha real con formato YYYY-MM-DD" }

  return { value: { type, description, amount, categoryId, transactionDate } }
}

function validateCategoryPayload(payload) {
  if (!hasOnlyKeys(payload, ["name", "type"])) return { error: "La categoría contiene campos no permitidos" }

  const name = cleanString(payload.name)
  const type = payload.type

  if (!name || name.length > 100) return { error: "El nombre debe tener entre 1 y 100 caracteres" }
  if (!["income", "expense"].includes(type)) return { error: "Tipo de categoría inválido" }

  return { value: { name, type } }
}

function validateBudgetPayload(payload) {
  if (!hasOnlyKeys(payload, ["category_id", "amount", "month"])) return { error: "El presupuesto contiene campos no permitidos" }

  const categoryId = parsePositiveInt(payload.category_id)
  const amount = parseMoney(payload.amount)
  const month = payload.month

  if (!categoryId) return { error: "Selecciona una categoría válida" }
  if (amount === null) return { error: "El presupuesto debe ser positivo y no exceder 9,999,999,999.99" }
  if (!isRealMonth(month)) return { error: "Mes inválido. Usa YYYY-MM" }

  return { value: { categoryId, amount, monthDate: `${month}-01` } }
}

function validateGoalPayload(payload) {
  if (!hasOnlyKeys(payload, ["name", "target_amount", "saved_amount", "target_date"])) {
    return { error: "La meta contiene campos no permitidos" }
  }

  const name = cleanString(payload.name)
  const targetAmount = parseMoney(payload.target_amount)
  const savedAmount = payload.saved_amount === undefined
    ? 0
    : parseMoney(payload.saved_amount, { allowZero: true })
  const targetDate = payload.target_date || null

  if (!name || name.length > 120) return { error: "El nombre de la meta debe tener entre 1 y 120 caracteres" }
  if (targetAmount === null) return { error: "El monto objetivo debe ser positivo y no exceder 9,999,999,999.99" }
  if (savedAmount === null) return { error: "El monto ahorrado debe ser válido y no negativo" }
  if (targetDate !== null && !isRealDate(targetDate)) return { error: "Ingresa una fecha objetivo real" }

  return { value: { name, targetAmount, savedAmount, targetDate } }
}

module.exports = {
  MONEY_MAX,
  cleanString,
  hasOnlyKeys,
  isRealDate,
  isRealMonth,
  parseLimit,
  parseMoney,
  parseOffset,
  parsePositiveInt,
  validateAuthPayload,
  validateBudgetPayload,
  validateCategoryPayload,
  validateGoalPayload,
  validateTransactionPayload
}
