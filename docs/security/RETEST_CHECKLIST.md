# Security Retest Checklist

Run the same authorized localhost audit used for the baseline and compare results against `SECURITY_AUDIT_BASELINE.md`.

Expected regression checks:

- IDOR isolation remains PASS for transactions, categories, budgets, goals, analytics, and sessions.
- SQL-injection payloads remain inert data.
- Stored XSS still renders as text.
- bcrypt remains cost 12 and hashes are never returned.
- real `.env` files, `.finance-app.env`, JWTs, cookies, and `node_modules` remain outside Git.

Expected hardening changes:

- 15 sequential bad logins against one disposable account should encounter HTTP 429 after the configured threshold.
- replaying the old JWT after logout should return HTTP 401.
- authenticated POST/PATCH/DELETE without `X-CSRF-Token` should return HTTP 403.
- an authenticated write with `Origin: http://evil.example` should return HTTP 403.
- impossible dates, overlong strings, oversized money values, and unexpected JSON fields should return HTTP 400 rather than 500.
- API responses should omit `X-Powered-By` and include the configured browser security headers.
- transaction history should return bounded pages with `next_cursor` rather than every row.
- category and goal list queries should have maximum page sizes.

Do not print or store JWTs, CSRF tokens, cookies, password hashes, database credentials, or environment-file contents in the report.
