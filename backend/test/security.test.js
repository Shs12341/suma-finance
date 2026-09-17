const test = require("node:test")
const assert = require("node:assert/strict")

const {
  isRealDate,
  isRealMonth,
  parseMoney,
  validateTransactionPayload,
  validateCategoryPayload,
  validateGoalPayload
} = require("../src/security/validation")
const { encodeCursor, decodeCursor } = require("../src/security/pagination")
const { createRateLimiter } = require("../src/security/rateLimit")
const { createCsrfToken } = require("../src/security/csrf")

test("calendar validation rejects impossible dates", () => {
  assert.equal(isRealDate("2026-02-28"), true)
  assert.equal(isRealDate("2026-02-31"), false)
  assert.equal(isRealDate("2026-13-01"), false)
  assert.equal(isRealMonth("2026-09"), true)
  assert.equal(isRealMonth("2026-19"), false)
})

test("money validation matches NUMERIC(12,2) bounds", () => {
  assert.equal(parseMoney("10.25"), 10.25)
  assert.equal(parseMoney("0"), null)
  assert.equal(parseMoney("10.999"), null)
  assert.equal(parseMoney("10000000000.00"), null)
  assert.equal(parseMoney("0", { allowZero: true }), 0)
})

test("transaction schema rejects oversized and unexpected input", () => {
  const valid = validateTransactionPayload({
    type: "expense",
    description: "Food",
    amount: "10.25",
    category_id: 1,
    transaction_date: "2026-09-17"
  })
  assert.ok(valid.value)

  assert.ok(validateTransactionPayload({ ...valid.value, description: "x".repeat(201) }).error)
  assert.ok(validateTransactionPayload({
    type: "expense",
    description: "Food",
    amount: "10.25",
    category_id: 1,
    transaction_date: "2026-02-31"
  }).error)
  assert.ok(validateTransactionPayload({
    type: "expense",
    description: "Food",
    amount: "10.25",
    category_id: 1,
    transaction_date: "2026-09-17",
    admin: true
  }).error)
})

test("category and goal schemas enforce database-aligned limits", () => {
  assert.ok(validateCategoryPayload({ name: "x".repeat(101), type: "expense" }).error)
  assert.ok(validateGoalPayload({
    name: "Trip",
    target_amount: "500",
    saved_amount: "0",
    target_date: "2026-02-31"
  }).error)
})

test("pagination cursor round-trips and rejects malformed values", () => {
  const cursor = encodeCursor({ date: "2026-09-17", id: 42 })
  assert.deepEqual(decodeCursor(cursor), { date: "2026-09-17", id: 42 })
  assert.equal(decodeCursor("not-a-cursor"), null)
})

test("CSRF token is bound to the server secret and session id", () => {
  const previous = process.env.JWT_SECRET
  process.env.JWT_SECRET = "a".repeat(64)
  const first = createCsrfToken("session-a")
  const second = createCsrfToken("session-b")
  assert.notEqual(first, second)
  assert.equal(first, createCsrfToken("session-a"))
  process.env.JWT_SECRET = previous
})

test("rate limiter returns 429 after its configured threshold", () => {
  const limiter = createRateLimiter({
    windowMs: 60_000,
    max: 2,
    keyGenerator: () => `test-${Date.now()}-${Math.random()}`,
    message: "limited"
  })

  // Use one stable limiter key for this test.
  const stableLimiter = createRateLimiter({
    windowMs: 60_000,
    max: 2,
    keyGenerator: () => "unit-test-stable-key",
    message: "limited"
  })

  let statusCode = 200
  const req = {}
  const res = {
    setHeader() {},
    status(code) { statusCode = code; return this },
    json(payload) { this.payload = payload; return this }
  }

  let nextCalls = 0
  stableLimiter(req, res, () => { nextCalls += 1 })
  stableLimiter(req, res, () => { nextCalls += 1 })
  stableLimiter(req, res, () => { nextCalls += 1 })

  assert.equal(nextCalls, 2)
  assert.equal(statusCode, 429)
  assert.equal(res.payload.error, "limited")
  assert.equal(typeof limiter, "function")
})
