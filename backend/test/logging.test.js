const test = require("node:test")
const assert = require("node:assert/strict")

const { safeError, securityEvent } = require("../src/security/logger")

function fakeRequest() {
  return {
    requestId: "test-request-1234",
    method: "POST",
    originalUrl: "/api/auth/login?debug=true",
    ip: "127.0.0.1",
    user: { id: 42 },
    socket: {}
  }
}

test("safeError never serializes raw request body or secret-like properties", () => {
  const previousSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = "a".repeat(64)

  const captured = []
  const original = console.error
  console.error = line => captured.push(String(line))

  try {
    const error = new SyntaxError("Unexpected end of JSON input")
    error.type = "entity.parse.failed"
    error.status = 400
    error.body = '{"email":"person@example.test","password":"SuperSecret123"'
    error.cookie = "finance_session=should-not-appear"

    safeError(error, fakeRequest(), { status: 400, category: "invalid_json" })
  } finally {
    console.error = original
    process.env.JWT_SECRET = previousSecret
  }

  assert.equal(captured.length, 1)
  const line = captured[0]
  assert.match(line, /"event":"request_error"/)
  assert.match(line, /"category":"invalid_json"/)
  assert.match(line, /"request_id":"test-request-1234"/)
  assert.doesNotMatch(line, /SuperSecret123/)
  assert.doesNotMatch(line, /person@example\.test/)
  assert.doesNotMatch(line, /finance_session/)
  assert.doesNotMatch(line, /"body"/)
})

test("securityEvent only accepts allowlisted metadata fields", () => {
  const previousSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = "b".repeat(64)

  const captured = []
  const original = console.log
  console.log = line => captured.push(String(line))

  try {
    securityEvent("auth_login_success", fakeRequest(), {
      status: 200,
      outcome: "success",
      password: "must-not-log",
      token: "must-not-log",
      arbitrary: "must-not-log"
    })
  } finally {
    console.log = original
    process.env.JWT_SECRET = previousSecret
  }

  assert.equal(captured.length, 1)
  const parsed = JSON.parse(captured[0])
  assert.equal(parsed.status, 200)
  assert.equal(parsed.outcome, "success")
  assert.equal(parsed.user_id, 42)
  assert.equal(parsed.path, "/api/auth/login")
  assert.equal("password" in parsed, false)
  assert.equal("token" in parsed, false)
  assert.equal("arbitrary" in parsed, false)
})
