# Security Hardening Checkpoint

## Baseline

Commit before hardening: `6b23e14` — `Add budgets goals and financial analytics`.

The baseline audit reported:

- 0 critical
- 0 high
- 2 medium
- 5 low
- 2 informational findings

The two medium findings were missing auth throttling and JWTs remaining usable after logout.

## Changes in this checkpoint

### Revocable sessions

A new `auth_sessions` table records each issued session. JWTs now carry a random `jti`. Authentication verifies both the JWT and the server-side session record. Logout marks the current record revoked, so replaying the prior token should return 401.

New endpoints:

- `GET /api/auth/sessions`
- `GET /api/auth/csrf`
- `POST /api/auth/logout-all`
- `DELETE /api/auth/sessions/:id`

### Authentication throttling

Login and registration are protected with fixed-window in-memory limits. Responses expose standard limit metadata and return HTTP 429 plus `Retry-After` when exceeded.

### CSRF and origin validation

Authenticated state changes require `X-CSRF-Token`, bound to the active session. Browser writes with an Origin other than `CLIENT_ORIGIN` return 403.

### Validation

Validation was centralized under `backend/src/security/validation.js`. It now rejects impossible dates, strings beyond schema limits, numeric values beyond `NUMERIC(12,2)`, malformed IDs, unexpected fields, and invalid page parameters before PostgreSQL.

### Headers

The API disables `X-Powered-By` and sets nosniff, frame protection, referrer, permissions, resource policy, and CSP headers. Vite development/preview responses also receive browser security headers. Production hosting should enforce its own strict CSP/HTTPS/HSTS policy.

### Bounded data access

Transactions use cursor pagination with a maximum page size of 100. Categories and goals support bounded limit/offset queries. Budgets and analytics are naturally bounded by month/history limits.

### Safer business behavior

Category deletion is blocked while budgets reference the category, avoiding silent budget deletion. Budget POST is documented as an idempotent save/upsert and returns 200.

### Automated checks

`npm test` in `backend` runs focused Node tests for date/money validation, unexpected fields, cursor parsing, session-bound CSRF token generation, and rate limiting.

## Retest goals

The same external audit should verify at minimum:

1. Fifteen wrong-password attempts now produce HTTP 429.
2. Replaying a JWT after logout now produces HTTP 401.
3. Authenticated writes without CSRF token return HTTP 403.
4. Evil Origin state-changing requests return HTTP 403.
5. Impossible dates and over-limit fields return HTTP 400 instead of 500.
6. Security headers are present and `X-Powered-By` is absent.
7. Large transaction histories are paginated.
8. Existing IDOR, SQL injection, XSS, bcrypt, CORS, and secret-hygiene protections continue to pass.
