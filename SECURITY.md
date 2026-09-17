# Security

Finance App is a portfolio application, but the security controls are implemented as real application controls rather than UI-only checks.

## Current controls

- Passwords are hashed with bcrypt (cost 12); plaintext passwords are never stored.
- Authentication uses an HttpOnly, SameSite=Lax cookie.
- JWTs contain a unique session identifier (`jti`) and are backed by revocable PostgreSQL sessions.
- Logout revokes the server-side session; a replayed old token is rejected.
- Users can inspect active sessions and revoke other sessions or all sessions.
- Every user-owned SQL query is scoped by authenticated `user_id`.
- State-changing authenticated requests require a session-bound CSRF token.
- Unsafe requests with an untrusted browser `Origin` are rejected.
- Authentication endpoints have IP/credential rate limits.
- Request bodies are limited to 100 KB.
- Server-side validation enforces string lengths, actual calendar dates, IDs, enums, and PostgreSQL-compatible money bounds.
- SQL uses parameter placeholders for user-controlled values.
- Transaction history is cursor-paginated and list endpoints have maximum page sizes.
- API and Vite development responses include defense-in-depth browser headers.
- Express framework disclosure is disabled.

## Session model

The JWT is not treated as the sole source of truth. Each login creates an `auth_sessions` row containing a random token ID, expiration time, and basic client metadata. Protected requests must pass both JWT verification and an active-session database lookup.

This allows logout and account-wide logout to invalidate previously issued JWTs before their cryptographic expiration.

## CSRF model

For authenticated writes, the frontend obtains a CSRF token from `GET /api/auth/csrf`. The token is an HMAC derived from the current server-side session identifier and is kept in frontend memory. POST/PATCH/DELETE requests include it in `X-CSRF-Token`.

The API also validates browser `Origin` values and keeps SameSite cookies and strict CORS as additional layers.

## Rate limiting

The local/single-process implementation uses bounded in-memory counters for login and registration. A production multi-instance deployment should move limiter state to a shared store such as Redis or a managed rate-limiting layer.

## Baseline audit

The pre-hardening audit is preserved at:

`docs/security/SECURITY_AUDIT_BASELINE.md`

It found no verified critical/high issues, but identified rate limiting, JWT revocation, CSRF defense-in-depth, validation bounds, headers, and pagination as the main hardening targets. This checkpoint directly addresses those targets.

## Reporting

Do not include passwords, JWTs, cookies, password hashes, database credentials, or `.finance-app.env` contents in issues, screenshots, or reports.
