# Security Gate V3 Retest Checklist

This retest is intentionally narrower than V2. Its job is to verify the remaining security-gate remediation and confirm no regression in previously strong controls.

## Must pass

- Malformed login JSON returns a generic 400 and server logs contain no raw body, password-like content, cookie, JWT, CSRF token or authorization header.
- Oversized auth requests return 413 and logs remain redacted.
- Login for an existing account with a wrong password and login for a nonexistent account both perform bcrypt work; no large deterministic timing oracle remains.
- Failed login, rate-limit block, CSRF rejection, Origin rejection, logout, logout-all and session revoke generate structured JSON security events without sensitive values.
- Concurrent category delete + transaction create cannot silently produce an uncategorized transaction. One operation must fail safely with a controlled conflict/error.

## Regression smoke tests

- IDOR/BOLA isolation still passes for transactions, categories, budgets, goals, analytics and sessions.
- Revoked/logout JWT replay returns 401.
- CSRF token from another session fails.
- Hostile Origin fails.
- JWT `alg:none` / signature tampering fails.
- SQL-like strings remain inert data.
- Stored XSS remains inert text.
- Validation/pagination bounds continue returning controlled 4xx responses.
- `npm audit` remains clean or any new advisory is documented.
- Real environment files and secrets remain outside Git.

## Gate rule

Security v1 passes when no Critical, High or Medium finding remains and the mandatory checks above are runtime verified.
