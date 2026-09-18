# Finance App Security Audit V2

## Executive Summary

**Security gate: FAIL.** The hardened local application fixed the baseline medium-risk authentication and session flaws and showed strong authorization, CSRF, validation, pagination, and browser-rendering controls. One newly verified **MEDIUM** finding remains: the centralized Express error handler logs whole malformed-request error objects before returning a sanitized response. For JSON parse errors, those objects include the raw request body. A malformed login request could therefore cause credential-like material to be written to application logs.

No Critical or High findings were verified. The retest also found a low-severity account-enumeration timing oracle, an observability gap for security events, and a business-data race that can leave a newly created transaction without a category when its category is deleted concurrently.

## Security Gate Decision

| Decision | Reason |
|---|---|
| **FAIL** | Gate criteria require zero unresolved Critical, High, or Medium findings. `V2-01` is unresolved at Medium severity. |

Finding totals: **Critical 0, High 0, Medium 1, Low 3, Informational 3.**

## Scope and Method

| Item | Details |
|---|---|
| Application assessed | Local Finance App, frontend `http://localhost:5173`, API `http://localhost:3000/api` |
| Source assessed | `C:\Users\yessy\finance-app\finance-app` at `529aa80c2fdead043a541e9a78da839158f39dce` |
| Runtime method | Browser checks on the supplied local frontend and authenticated API retest using disposable accounts. A code-equivalent local API instance on port 3001 was used only to keep rate-limit windows isolated. |
| Data handling | Scoped test records were removed through the authenticated application API. Disposable accounts were retained as required. No production or third-party systems were contacted. |
| Exclusions | Destructive tests, stress tests, data exfiltration, secret extraction, source changes, and attacks against non-local targets were excluded. |

Reviewed materials included `SECURITY.md`, the baseline audit, the hardening checkpoint, the retest checklist, source code, migrations, dependency manifests/lockfiles, and runtime behavior.

## Threat Model and Attack Surface Inventory

| Surface | Primary threats assessed | Result |
|---|---|---|
| Authentication | registration/login enumeration, credential stuffing limits, session fixation, JWT tampering | Controls work; timing oracle and status-based registration enumeration remain. |
| Sessions | token replay, per-session revocation, logout-all, cross-user session deletion, races | Server-side session binding and revocation work. |
| Authorization | BOLA/IDOR across transactions, categories, budgets, goals, analytics, sessions | No cross-user read or write access verified. |
| Browser/API boundary | CORS, Origin, CSRF, cookies, preflight behavior | Exact-origin CORS and session-bound CSRF work. |
| Input handling | JSON parsing, body size, type confusion, validation, mass assignment, prototype pollution | Strict validation and generic client errors work; server log handling needs correction. |
| Data queries | pagination, cursor tampering, SQL injection patterns, filter boundaries | Bound parameters and cursor validation held; no injection or cross-user cursor leakage verified. |
| UI rendering | stored XSS in session metadata | Hostile User-Agent metadata rendered as inert text; no script execution. |
| Availability/business logic | rate limits, concurrent upserts, delete/create races | Limits held; one category-delete data-integrity race is documented below. |
| Supply chain/configuration | npm advisories, lifecycle/source references, tracked secret patterns, HTTP methods | Both npm audits were clean; no risky lifecycle/source references found; TRACE returned 404. |

Not applicable from source review: no file upload/download, server-side URL fetcher/webhook, redirect endpoint, path-based file access, template renderer, command execution, or XML parser was present. Request-smuggling testing was not meaningful against the direct local Express target with no reverse proxy in scope.

## Baseline Retest

| Baseline ID | Original severity | Current result | Status |
|---|---:|---|---|
| AUTH-01: no rate limiting | Medium | Login attempts were blocked on attempt 11; registration was blocked after 10 attempts with `Retry-After: 900`. Header-spoof attempts did not bypass the limiter. | **FIXED** |
| SESS-01: JWT survived logout | Medium | Per-session revoke, logout, logout-all, and replay checks rejected old session tokens; cross-user revocation was rejected. | **FIXED** |
| CSRF-01: partial CSRF defenses | Low | Missing, invalid, and other-session CSRF values failed; hostile/null/lookalike origins failed; trusted preflight was exact-origin only. | **FIXED** |
| HDR-01: missing security headers | Low | CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, COOP/CORP, referrer, and permissions policies were present; `X-Powered-By` was absent. | **FIXED** |
| VAL-01: insufficient validation | Low | Invalid calendar dates, money precision/range, unexpected/nested keys, arrays, malformed JSON, and oversized bodies were rejected. | **FIXED** |
| AUTH-02: registration enumeration | Low | Duplicate registration remains distinguishable by `409` versus `201`, although message text is generic. | **REMAINING** |
| DOS-01: unpaginated lists | Low | Cursor pagination works; cursor tampering and invalid/duplicate limits fail safely; server clamps excessive limits. | **FIXED** |
| BIZ-01: category/budget behavior | Informational | Budget upserts are idempotent and category deletion protects budget references. Goal over-target values remain allowed, and a transaction/category deletion race is discussed below. | **PARTIALLY FIXED** |
| GIT-01: example credential material | Informational | Only `.env.example` files were tracked in current/history filename review; no real secret was displayed or extracted. | **ACCEPTED / HYGIENE REMINDER** |

## New Findings

### V2-01 — Raw malformed request bodies can be written to application logs

**Severity: MEDIUM**  
**Status: OPEN**  
**Category: OWASP A09 Security Logging and Monitoring Failures / sensitive log-data exposure**

The centralized error path calls `console.error(error)` before mapping malformed JSON and oversized-body errors to safe client responses. Express's JSON parser error object includes the raw malformed request `body`. During a harmless malformed-JSON check, the server console showed the parser error and its raw `body` property. A deliberately malformed authentication request could consequently write credential-like request content to application logs.

This was not demonstrated with a password, token, cookie, or other secret. The issue is nevertheless verified because the error object's observed shape includes raw request content.

**Impact:** Anyone able to read centralized/local application logs could obtain sensitive request content that the application correctly avoids returning to the browser. This violates the assessment requirement that logs not contain passwords, tokens, or session material.

**Recommendation:** Log a normalized, allowlisted error event instead of the raw error object. Record a correlation ID, route, error class/code, status, and bounded metadata; explicitly omit request body, authorization/cookie headers, CSRF values, and tokens. Apply the same redaction at any upstream logger/transport.

### V2-02 — Login timing distinguishes existing from nonexistent accounts

**Severity: LOW**  
**Status: OPEN**  
**Category: Authentication enumeration**

For three controlled samples, an incorrect password for an existing disposable account took approximately 470–574 ms, while the same request for a nonexistent account took approximately 5–6 ms. The route performs bcrypt comparison only after a user record is found. Generic response text and rate limiting reduce impact but do not remove the timing signal.

**Recommendation:** Always execute a bcrypt comparison using a fixed dummy hash when the account is absent, and retain the existing generic response and rate limits.

### V2-03 — Security-significant events lack structured audit logging

**Severity: LOW**  
**Status: OPEN**  
**Category: OWASP A09 / ASVS logging and monitoring**

Source review found generic error logging but no structured, redacted event trail for authentication success/failure, rate-limit decisions, CSRF/origin denials, authorization failures, session revocation, or administrative-security actions.

**Impact:** Incident detection and forensic reconstruction are weaker, while the current generic error logging creates the separate sensitive-data risk in V2-01.

**Recommendation:** Add structured, privacy-preserving security events with request/correlation ID, timestamp, event type, result, route, and safely pseudonymized actor/network context. Alert on threshold breaches and repeated authorization/CSRF failures.

### V2-04 — Concurrent category deletion can orphan a just-created transaction

**Severity: INFORMATIONAL**  
**Status: OPEN (business-policy decision)**

With the allowed 10-request race bound, a category delete and a transaction creation referencing it both succeeded concurrently. The transaction was retained with a null category because the foreign key uses `ON DELETE SET NULL`.

**Impact:** No cross-user access or injection was involved, but reports/category budgets may momentarily or permanently omit the transaction's intended classification.

**Recommendation:** Decide whether preserving an uncategorized transaction is desired. If not, serialize the operation or reject category deletion when transactions reference it; document the intended behavior either way.

### V2-05 — In-memory rate limiting is deployment-topology dependent

**Severity: INFORMATIONAL**  
**Status: ACCEPTED LOCAL RISK / REVIEW BEFORE SCALE-OUT**

The limiter performed correctly in this single-process local assessment. It stores counters in process memory, so limits are not shared across multiple API instances and reset on restart.

**Recommendation:** For horizontally scaled or restart-sensitive deployments, use a shared atomic store and ensure trusted-proxy configuration is explicit and tested.

### V2-06 — Goal balances can exceed the configured target

**Severity: INFORMATIONAL**  
**Status: OPEN (business-policy decision)**

Creating a goal with saved amount above target was accepted. This may be valid if targets are milestones rather than caps.

**Recommendation:** Either enforce `saved_amount <= target_amount` or explicitly represent/report overfunded goals.

## Verified Controls

- Server-side `auth_sessions` binding makes JWTs revocable; post-logout/revocation replay returned `401`.
- Cross-user object and session access returned `404` and did not expose the target data.
- Per-session, logout-all, and session fixation checks worked; a request concurrent with a revocation may complete, but later replay did not.
- State-changing requests required a session-bound HMAC CSRF value and a trusted browser Origin.
- CORS allowed only the configured frontend origin with credentials; hostile origins did not receive ACAO.
- Strict JSON, allowlisted keys, date/money bounds, body-size cap, pagination bounds, and parameterized database access rejected hostile payload shapes.
- User-Agent text containing markup rendered as text in the React security-session UI; no stored XSS executed.
- Signature tampering, payload alteration, `alg: none`, and missing cookies all returned `401`.
- Ten concurrent budget upserts left one scoped record, demonstrating the intended unique/upsert behavior.
- `npm audit --json` reported zero known vulnerabilities for backend (102 dependencies) and frontend (168 dependencies); manifest/lockfile scan found no lifecycle scripts or git/file/HTTP dependency references.
- TRACE was unavailable (`404`), and no dangerous runtime sinks (`eval`, command execution, unsafe HTML rendering) were found in application source review.

## Evidence Notes and Limitations

- The browser test used an isolated in-app browser tab; an existing real-user browser session was not accessed.
- Test artifacts were limited to disposable accounts and scoped records. Scoped transactions, budgets, goals, and categories were deleted after verification; accounts were retained.
- No secret, password, session cookie, JWT, hash, or full PII was copied into this report.
- Authentication rate-limit tests stayed within the authorized attempt bound. Concurrency tests did not exceed 10 requests.
- Current git working tree had a pre-existing/unattributed modification: `backend/package-lock.json`. It was not changed by this assessment.

## Remediation Priorities

1. **Before release:** remediate V2-01 by replacing raw error-object logging with centralized redacted logging; retest malformed login/request handling and downstream log transports.
2. **Next:** add constant-work login handling for absent users, while retaining generic messages and rate limits.
3. **Next:** add structured security-event logging with alerting and explicit retention/access policy.
4. **Product decision:** define required behavior for category deletion races and over-target goals.
5. **Before multi-instance deployment:** move rate-limit state to shared storage and test proxy/IP trust configuration.

## Retest Exit Criteria

The security gate can pass when V2-01 is fixed and revalidated: malformed JSON and oversized authentication requests must return generic client errors **and** produce only redacted/allowlisted log events. A follow-up should also confirm that no log aggregation, error tracker, or reverse proxy captures request bodies or auth headers.
