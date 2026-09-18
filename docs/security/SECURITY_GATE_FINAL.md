# Security Gate Final Checkpoint

This checkpoint follows the V2 adversarial audit of commit `529aa80`.

## V2 finding addressed: raw malformed request data in logs

The global Express error path no longer writes raw Error objects. Parser errors can contain the original request body, so logging them directly can persist credentials or other sensitive data even when the HTTP response is sanitized.

The new logger emits only an allowlisted JSON event containing bounded metadata such as request ID, route, status, error class/code/type and a pseudonymized network identifier. Request bodies, cookies, authorization material, CSRF tokens, JWTs, password hashes and database secrets are never accepted as log metadata.

Every request now receives `X-Request-ID`, which can be used to correlate a client error with a sanitized server event without exposing request contents.

## Timing-enumeration hardening

Login now performs bcrypt work whether or not the submitted email exists. A fixed dummy bcrypt hash is used for absent users, reducing the large timing difference discovered in the V2 audit while preserving generic authentication responses and existing rate limits.

## Security event logging

Structured, redacted events now cover important security actions including:

- successful and failed authentication
- authentication rate-limit blocks
- rejected session cookies/JWT/session records
- CSRF failures
- rejected browser origins
- logout and logout-all
- individual session revocation
- sanitized request-processing errors

The event logger uses an explicit metadata allowlist. It is designed for stdout today and can later feed a production log transport without changing the redaction contract.

## Category delete/create race

The product policy is now explicit: a category in use by a transaction or budget cannot be deleted.

Migration `004_security_gate_final.sql` changes category foreign keys to `ON DELETE RESTRICT`. This gives PostgreSQL the final say during concurrent create/delete operations, closing the race where a transaction could be created while its category was being deleted and silently become uncategorized.

## Accepted design decisions

- Savings goals may exceed 100% of their target. A goal target is treated as a milestone, not a hard cap.
- The current rate limiter remains in process memory because the app is single-instance/local. Before horizontal deployment it must move to a shared atomic store such as Redis or a managed gateway limiter.
- Duplicate-account registration remains distinguishable by status. This is accepted for the current product; generic login responses and throttling remain in place.

## Retest exit criteria

A final adversarial retest should verify at minimum:

1. Malformed JSON and oversized auth requests never place body content, passwords, cookies, JWTs or CSRF tokens into logs.
2. Existing-user and nonexistent-user failed logins have materially closer response timing.
3. Structured security events are emitted for login failures, limiter blocks, CSRF/origin denials and session revocation without sensitive values.
4. A concurrent category delete and transaction creation cannot leave a transaction with a silently cleared category.
5. All previously verified authorization, session revocation, CSRF, CORS, JWT, validation, pagination, XSS, SQL-parameterization and dependency controls continue to pass.
