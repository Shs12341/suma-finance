# Finance App Security Audit

## Executive Summary

The current application has a solid authorization baseline. Every reviewed user-owned query is scoped to the authenticated `user_id`, cross-user runtime tests did not disclose or alter User A data, analytics remained isolated, SQL statements use parameters, bcrypt is used with cost 12, and stored XSS payloads rendered as inert text in the React UI.

No critical or high-severity vulnerability was verified. The most important weaknesses are the absence of authentication rate limiting and the fact that logout only clears the browser cookie: a previously captured JWT remains usable until its seven-day expiration. Defense-in-depth is also incomplete around CSRF validation, security headers, bounded input validation, and pagination.

Finding totals (excluding passing controls): 0 critical, 0 high, 2 medium, 5 low, and 2 informational.

## Environment

- Audit date: 2026-09-17 (America/Guayaquil)
- Audited repository: `C:\Users\yessy\finance-app`
- Commit: `6b23e1419c3078161461c743ba244993fc67b88a`
- Frontend: `http://localhost:5173` (HTTP 200)
- Backend: `http://localhost:3000` (health HTTP 200; database connected)
- Node.js: `v22.17.0`
- npm: `10.9.2`
- Architecture: React/Vite, Express 5, PostgreSQL, JWT in an HttpOnly cookie
- Runtime mode: local HTTP development. The session cookie did not carry `Secure`; source enables it when `NODE_ENV === "production"`.
- Persistent environment file: the application reported loading `C:\Users\yessy\.finance-app.env`. The file and its values were not printed, copied, modified, or included in this report.
- Pre-report Git status: `backend/package-lock.json` was already observed as modified (160 inserted lines versus HEAD). It was preserved. This audit did not reset it or create a commit.
- Disposable accounts created: `security-a@example.test`, `security-b@example.test`, and one isolated browser-only test account. No existing user account or existing user data was changed.
- Cleanup: disposable browser records and most API test records were removed through their user-scoped APIs. The disposable accounts remain because the application has no safe account-deletion endpoint. One XSS category, transaction, and goal remain only under disposable User A because its random session credential was intentionally not persisted after the harness completed.

## Findings

### [AUTH-01] Authentication endpoints have no brute-force throttling

Severity: MEDIUM

Status: FAIL

Affected component: `POST /api/auth/login`, `POST /api/auth/register`, `backend/server.js`, `backend/src/routes/auth.js`

Evidence: No rate-limiting or account-lockout middleware is declared in `backend/package.json`, `backend/server.js`, or the auth router. Fifteen sequential incorrect-password attempts against a disposable account all returned HTTP 401; none returned HTTP 429 and the account was not temporarily locked. Registration also performs bcrypt work without a request limiter.

Reproduction: Send 15 low-rate login requests with the correct disposable email and an incorrect password. Observed status distribution: `401 × 15`, `429 × 0`.

Impact: An attacker can repeatedly guess passwords and can consume CPU through bcrypt-backed login or registration requests. The bcrypt cost slows each attempt but is not a substitute for request throttling.

Recommendation: Add IP- and account-aware rate limits to login and registration, progressive backoff, monitoring, and a safe lockout or challenge policy. Keep error responses uniform and avoid creating an account-existence oracle in the limiter.

### [SESS-01] JWT remains valid after logout until expiration

Severity: MEDIUM

Status: NEEDS IMPROVEMENT

Affected component: `POST /api/auth/logout`, `backend/src/auth.js`, `backend/src/routes/auth.js`

Evidence: Session restoration returned HTTP 200 before logout. Logout returned HTTP 204 and expired the `finance_session` browser cookie. A copy of the old token retained only in the test process was then replayed against `GET /api/auth/me` and returned HTTP 200. Source creates a stateless JWT with `expiresIn: "7d"` and has no revocation list, token version, or server-side session record.

Reproduction: Authenticate a disposable user, retain the token in memory without printing it, call logout, then send the retained cookie to `GET /api/auth/me`. The replay was accepted.

Impact: If a token is stolen, the user cannot invalidate it by logging out; it remains usable for up to approximately seven days unless the signing secret changes or the user is deleted.

Recommendation: Use revocable server-side sessions or add a token/session identifier and revocation store. Consider shorter-lived access tokens with rotated refresh tokens, session-version invalidation, and an “invalidate all sessions” control.

### [CSRF-01] CSRF defense relies on SameSite and browser CORS behavior

Severity: LOW

Status: NEEDS IMPROVEMENT

Affected component: Cookie-authenticated POST/PATCH/DELETE routes and `backend/server.js`

Evidence: The cookie is `HttpOnly; SameSite=Lax`, which is useful, and JSON write requests normally trigger a browser preflight. There is no CSRF token and no Origin or Referer validation. A direct state-changing request carrying a valid test cookie and `Origin: http://evil.example` was processed with HTTP 201. The response did not reflect the evil origin: it returned `Access-Control-Allow-Origin: http://localhost:5173` and `Access-Control-Allow-Credentials: true`. An evil-origin preflight returned HTTP 204 with the same trusted-origin ACAO value, so a normal browser would not authorize the evil origin.

Reproduction: Send a harmless category creation request with a disposable authenticated cookie and an untrusted Origin header. The server accepts it; browser-enforced CORS is what prevents the tested cross-origin frontend from completing a credentialed JSON flow.

Impact: Cross-site risk is materially reduced by SameSite=Lax and JSON preflights, but CORS is not a CSRF control. Same-site sibling origins, changes to cookie policy, simple-content routes such as logout, or non-browser clients can bypass the assumptions. The present result is partial protection rather than a verified server-side rejection.

Recommendation: Validate `Origin` on every state-changing request against an explicit allowlist and add a CSRF token (synchronizer or signed double-submit pattern). Continue using SameSite and strict CORS as additional layers. Reject unsupported content types on JSON endpoints.

### [HDR-01] Browser security headers are absent

Severity: LOW

Status: NEEDS IMPROVEMENT

Affected component: Backend responses and frontend HTML delivery

Evidence: Live responses from both `http://localhost:3000/api/health` and `http://localhost:5173/` lacked Content-Security-Policy, X-Content-Type-Options, X-Frame-Options/frame-ancestors, Referrer-Policy, and Permissions-Policy. The API exposed `X-Powered-By: Express`. No Helmet-equivalent middleware is installed. HSTS was also absent, but that is expected on localhost HTTP and is not treated as a standalone vulnerability here.

Reproduction: Inspect the response headers from the frontend root and backend health endpoint.

Impact: If a future rendering or content-type issue is introduced, the browser has fewer defense-in-depth restrictions. Framing, MIME sniffing, referrer leakage, and unnecessary framework disclosure are not explicitly controlled.

Recommendation: Add and configure Helmet or equivalent middleware, disable `X-Powered-By`, and set an application-specific CSP on the production frontend. Define `frame-ancestors`, `nosniff`, Referrer-Policy, and a minimal Permissions-Policy. Enable HSTS only on the production HTTPS deployment.

### [VAL-01] Incomplete server-side bounds and date validation produces HTTP 500 responses

Severity: LOW

Status: FAIL

Affected component: Transaction, category, and goal validation

Evidence: Negative/zero/non-numeric amounts, invalid transaction types, empty descriptions, missing required fields, and invalid category IDs correctly returned HTTP 400. However, an impossible date matching the `YYYY-MM-DD` regex, a transaction description over the database limit, an oversized numeric amount, a category name over 100 characters, and an impossible goal date each reached PostgreSQL and returned HTTP 500 with a generic error. Source uses format-only date checks and omits some database-aligned maximums.

Reproduction:

| Endpoint | Safe invalid input | Status |
| --- | --- | ---: |
| `POST /api/transactions` | `amount: -1`, `0`, or `"hello"` | 400 |
| `POST /api/transactions` | `type: "banana"` | 400 |
| `POST /api/transactions` | empty description | 400 |
| `POST /api/transactions` | nonexistent category | 400 |
| `POST /api/transactions` | impossible date | 500 |
| `POST /api/transactions` | amount beyond `NUMERIC(12,2)` | 500 |
| `POST /api/transactions` | description over 200 characters | 500 |
| `POST /api/categories` | name over 100 characters | 500 |
| `POST /api/goals` | impossible date | 500 |
| `POST /api/goals` | negative saved amount | 400 |
| JSON parser | malformed JSON | 400 |
| JSON parser | body slightly over 100 KB | 413 |

Impact: Invalid client data causes internal-error handling and log noise, obscures actionable validation feedback, and can increase operational load. No SQL text, stack trace, filesystem path, or credential was returned in these database-error cases.

Recommendation: Use a shared schema validator, enforce exact string lengths and numeric precision before SQL, and validate dates by round-tripping a real calendar date rather than using only a regex. Convert known constraint failures to consistent HTTP 400/409 responses.

### [AUTH-02] Registration discloses whether an email already exists

Severity: LOW

Status: NEEDS IMPROVEMENT

Affected component: `POST /api/auth/register`

Evidence: Registering an existing disposable email returned HTTP 409 with “Ya existe una cuenta con ese correo,” while a new account returned HTTP 201. Login correctly returned the same HTTP 401 body for a nonexistent user and for an incorrect password.

Reproduction: Register a disposable email, then repeat registration with the same email. Compare with registration using an unused email.

Impact: Attackers can enumerate registered email addresses through the registration endpoint. The severity depends on whether account membership is considered sensitive.

Recommendation: If membership privacy matters, return a generic registration response and handle existing accounts through an out-of-band recovery flow. Rate limiting remains necessary either way.

### [DOS-01] User list endpoints are unpaginated

Severity: LOW

Status: NEEDS IMPROVEMENT

Affected component: `GET /api/transactions`, `GET /api/categories`, and `GET /api/goals`

Evidence: These endpoints select and serialize every row owned by the authenticated user without a `LIMIT`, cursor, or page-size ceiling. Analytics is better bounded: history is clamped to 3–12 months and category breakdown uses `LIMIT 8`. The JSON request body is capped at 100 KB.

Reproduction: Source inspection of the three list queries; no load test was performed.

Impact: A user with a large history can cause increasingly expensive queries, memory use, response serialization, and frontend rendering. This is primarily a resilience and scalability risk, not a cross-user data issue.

Recommendation: Add cursor-based pagination with a conservative maximum page size, indexed ordering, and response-size monitoring. Preserve the existing user scope on every page query.

### [BIZ-01] Several business-rule outcomes require an explicit product policy

Severity: INFORMATIONAL

Status: NEEDS IMPROVEMENT

Affected component: Savings goals, budgets, and category deletion

Evidence: A savings goal with saved amount 11 and target 10 was accepted with HTTP 201. Creating the same user/category/month budget twice returned HTTP 201 both times, kept the same ID, and updated the amount from 50 to 60 via the documented `ON CONFLICT ... DO UPDATE` query. Deleting a disposable category in use returned HTTP 204 and changed the related transaction to uncategorized because the schema uses `ON DELETE SET NULL`; budgets use `ON DELETE CASCADE`. In contrast, negative goal progress returned HTTP 400, income/expense category mismatches returned HTTP 400, and changing the type of a used category returned HTTP 409.

Reproduction: Use only disposable resources to create the combinations above, then inspect the returned records.

Impact: These behaviors may be intentional, but without an explicit product rule they can surprise users, erase budget records when a category is deleted, or allow goal progress beyond 100 percent.

Recommendation: Document the intended semantics. If overfunding is invalid, enforce `saved_amount <= target_amount`; otherwise label it as supported. Confirm destructive category consequences in the API/UI, and decide whether budget upsert should return HTTP 200 for an update rather than HTTP 201.

### [GIT-01] Historical README contained a common literal database-password example

Severity: INFORMATIONAL

Status: NEEDS IMPROVEMENT

Affected component: Git history and developer documentation

Evidence: Current tracking and history checks found no real `.env`, `.finance-app.env`, or `node_modules` path; only `.env.example` files are tracked, and `.gitignore` excludes environment files and dependencies. Variable-name-only history inspection found a common example `DB_PASSWORD` literal in README commit `37cea0cfd5dd`; the value is intentionally not reproduced here. Current setup scripts generate values dynamically, and current example files use placeholders.

Reproduction: Search Git history only for the variable names `DB_PASSWORD`, `DB_PASSWORD_B64`, and `JWT_SECRET`, then classify assignments without printing their values.

Impact: A common documentation credential is low risk by itself, but it can become a real credential if copied unchanged. Git history is durable even after the documentation is corrected.

Recommendation: Never provide a reusable literal password in setup instructions. Use obvious placeholders or generation commands. If the historical example was ever used by a real database, rotate that credential; do not rewrite history unless repository owners coordinate it.

## Authorization Matrix

| Resource | User A own resource | User B accessing A | Result |
| --- | --- | --- | --- |
| Transactions | Created successfully (201); present in A data | B list excluded A ID (200); direct GET route absent (404); PATCH returned 404 | PASS |
| Categories | Created successfully (201); present in A data | B list excluded A ID (200); PATCH returned 404 | PASS |
| Budgets | Created successfully (201); present in A month | B list excluded A ID (200); DELETE returned 404 and A record remained available for owner cleanup | PASS |
| Goals | Created successfully (201); present in A data | B list excluded A ID (200); PATCH returned 404 | PASS |
| Analytics | Source aggregates A transactions with A `user_id` | B analytics returned zero totals, no A category names, and no A sentinel content | PASS |

Additional authorization evidence:

- B could not create a transaction using A's category ID: HTTP 400.
- Transaction/category/budget/goal reads are list-based; no per-ID GET routes exist except the global 404 fallback.
- Unauthorized DELETE was exercised only for budgets after source inspection confirmed `WHERE id = $1 AND user_id = $2`. Destructive cross-user DELETE tests for the other resources were skipped because list/PATCH tests and source evidence already established the control, consistent with the audit's non-destructive rule.
- All analytics queries include authenticated `user_id`; history is clamped to at most 12 months.

## Security Controls Verified

- **Password storage — PASS:** Registration calls `bcrypt.hash(password, 12)`. A read-only check of the two API test users confirmed bcrypt-formatted hashes with cost 12 without printing hash values. Plaintext passwords are not inserted. Passwords are constrained to 8–72 characters.
- **Auth response minimization — PASS:** Registration and login returned only `id`, `name`, `email`, and `created_at` inside `user`; no password hash, JWT, stack trace, database metadata, or signing secret was exposed.
- **Login enumeration resistance — PASS:** Incorrect password and nonexistent email returned the same HTTP 401 status and body.
- **Protected routes — PASS:** Missing, invalid, and malformed session cookies returned HTTP 401. Session restoration returned HTTP 200 before logout; protected access without a cookie returned HTTP 401 after logout.
- **Cookie baseline — PASS/PARTIAL:** Observed `finance_session` with HttpOnly, SameSite=Lax, Path=/, and a seven-day Max-Age. Local HTTP correctly omitted Secure; source enables Secure in production. Runtime HTTPS behavior was not tested.
- **Authorization and IDOR — PASS:** Runtime cross-user list, PATCH, DELETE (budget), category-association, and analytics tests did not disclose or mutate A data. Source scopes transactions, categories, budgets, goals, and analytics by authenticated `user_id`.
- **SQL injection resistance — PASS:** SQL-like email, description, category, and goal values did not bypass authentication, expose SQL errors, or return another user's data. Source uses PostgreSQL placeholders for all user values; the only constructed SQL fragment is a fixed category filter selected after enum validation.
- **Stored XSS resistance — PASS:** `<script>` and `<img onerror>` payloads were stored in disposable category, transaction, and goal records. In an isolated browser session they appeared literally as text and produced no JavaScript dialog. Source search found no `dangerouslySetInnerHTML`, direct `innerHTML`, `eval`, or `new Function` usage.
- **CORS — PASS:** Credentialed responses advertise only `http://localhost:5173`; the untrusted origin was not reflected. No wildcard-plus-credentials combination was observed. This does not replace the separate CSRF recommendation.
- **Body-size limit — PASS:** `express.json({ limit: "100kb" })` is configured and a slightly oversized JSON body returned HTTP 413.
- **Error containment — PASS/PARTIAL:** Database constraint and conversion failures returned a generic HTTP 500 body without stack traces, SQL text, credentials, or filesystem paths. Malformed JSON returned a parser-position message, which is low-risk but could be normalized.
- **Dependency audit — PASS:** Backend `npm audit`: 0 vulnerabilities across 102 dependencies (102 production, 0 development). Frontend `npm audit`: 0 vulnerabilities across 168 dependencies (4 production, 165 development, 27 optional as npm reports overlapping categories). No audit fix was run.
- **Secret and Git hygiene — PASS/PARTIAL:** Real environment files and `node_modules` are not tracked; only examples are present. The persistent home-directory environment file was not exposed. See GIT-01 for the historical documentation example.
- **Business constraints — PASS/PARTIAL:** Positive amounts, valid transaction/category types, category ownership/type matching, nonnegative goal progress, positive budgets, and used-category type changes are enforced. See BIZ-01 for policy decisions.

## Prioritized Remediation

### P0 – fix immediately

No verified critical or high-severity issue requires an emergency P0 change.

### P1 – next security checkpoint

1. Add login and registration rate limiting, progressive delay, and monitoring.
2. Choose a revocable session design so logout and incident response can invalidate previously issued tokens.
3. Add schema-based server validation for real dates, string lengths, numeric precision, and consistent constraint-error mapping.
4. Add server-side Origin validation and a CSRF token strategy for state-changing cookie-authenticated requests.

### P2 – hardening / polish

1. Add production security headers, an application-specific CSP, and remove `X-Powered-By`.
2. Add pagination and maximum page sizes to list endpoints.
3. Decide whether registration should conceal account existence.
4. Formalize goal-overfunding, budget-upsert, and category-deletion semantics.
5. Remove reusable credential examples from documentation and rotate any credential that may have copied the historical example.

## Test Coverage

Performed:

- Full source review of auth, JWT creation/verification, cookie options, middleware, all API routes, SQL schema, validation, CORS, error handling, frontend API use, and React rendering.
- Valid registration, duplicate registration, invalid email, short/long password, empty values, wrong password, nonexistent user, response-field inspection, login comparison, session restoration, logout, missing/invalid/malformed JWT, and old-token replay.
- Two-user authorization tests covering list isolation, non-destructive cross-user PATCH attempts, safe budget DELETE, cross-user category association, and analytics isolation.
- Harmless SQL-like data tests in login, category, transaction, and goal inputs.
- Stored XSS API tests and live browser rendering for category, transaction, and savings-goal content.
- CORS trusted/untrusted Origin requests and preflights, CSRF control inspection, security-header capture, malformed JSON, unknown route, and 100 KB body-limit verification.
- Fifteen safe incorrect-login attempts.
- Backend-bypass validation and business-rule combinations listed above.
- Backend and frontend `npm audit` without fixes.
- Git status/log/tracked-file/history checks without printing secret values.
- Read-only bcrypt-format/work-factor verification for disposable test users.

Not performed or deliberately limited:

- No destructive SQL, database reset, user deletion, mass deletion, source modification, commit, or audit fix.
- No load or stress test. Denial-of-service review was limited to code inspection, a single body-limit request, pagination review, and the small login series.
- A genuinely expired, correctly signed JWT was not generated because doing so would require reading the signing secret or waiting for expiry. Source sets seven-day expiry and handles `TokenExpiredError`; this remains source-verified rather than runtime-verified.
- Production HTTPS cookie behavior and HSTS were not runtime-tested on localhost HTTP.
- No public site was hosted for a full browser CSRF exploit. The review used source inspection, Origin/preflight requests, and a direct authenticated client simulation.
- Cross-user DELETE for transactions, categories, and goals was not sent after the safer list/PATCH tests passed; source inspection confirmed each DELETE query also includes authenticated `user_id`.
- No server-side search endpoint exists; transaction search is client-side. SQL-like filter data therefore was not sent to a nonexistent API search function.
