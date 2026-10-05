# Authentication

The server database is authoritative for accounts, email verification, passwords, and sessions. Registration creates an unverified account and its first verification code in one transaction. A dropped response can be retried; an existing email receives the same generic registration response and can request another code.

## Endpoints

All routes are under `/api/v1/auth`. JSON request bodies use `Content-Type: application/json`; successful/error responses use `{ "success": boolean, "message": string, "data"?: object }`.

| Method and path | Request body | Result |
| --- | --- | --- |
| `POST /register` | `{ "email", "password", "role": "client" | "freelancer" }` | `202`; generic message directing the client to email verification |
| `POST /verify-email` | `{ "email", "code": "000000" }` | `200`; marks the address verified, returns a safe account profile, and sets session cookies |
| `POST /resend-otp` | `{ "email" }` | `200`; generic response whether or not a code was sent |
| `POST /login` | `{ "email", "password" }` | `200`; returns a safe account profile and sets session cookies |
| `POST /refresh` | No body; uses the refresh cookie | `200`; rotates the refresh token and updates both cookies |
| `POST /logout` | No body | `200`; revokes the presented refresh session and clears cookies |
| `GET /me` | No body | `200`; returns the safe account profile |
| `POST /forgot-password` | `{ "email" }` | Always `200` with a generic message; sends a reset code only for an existing verified account |
| `POST /reset-password` | `{ "email", "code": "000000", "password" }` | `200`; changes the password, consumes the code, revokes all sessions, and sends a notification |

The safe profile contains the account identifier, email, public role, verification/onboarding flags, identity-verification flag, and creation date. It never includes password or token hashes. Invalid login credentials return `401` with `Invalid email or password.`. An unverified account receives `403` with `EMAIL_NOT_VERIFIED`; invalid, expired, consumed, or exhausted codes share a generic error.

## Verification And Limits

Codes contain six digits, are generated with a cryptographic random source, and expire after ten minutes. Only an HMAC-SHA256 digest is stored, keyed by `OTP_HMAC_SECRET`; comparisons use constant-time equality. A code allows five failed attempts. Issuing a replacement consumes previous active codes. Resends have a 60-second cooldown and a five-per-account, per-purpose hourly cap. OTP endpoints also have an eight-per-hour per-email-and-IP limiter; other sensitive auth routes have a 30-per-15-minute IP limiter.

Passwords are Argon2id-hashed, must be 10-128 characters, and a short denylist of common values is rejected. Login failures increment the account counter; five failures lock that account for 15 minutes. When Redis is ready, login attempts are also counted per IP; the database remains authoritative for account and session state.

Refresh tokens are opaque random values; only SHA-256 hashes are stored. Rotation revokes the previous token and links it to its replacement. Reuse of a rotated token revokes its session family. Password reset revokes all active sessions for the account.

## Cookies And Browser Security

The cookies are `om_access` (default 15 minutes) and `om_refresh` (default 30 days). Both are `httpOnly`, `SameSite=Strict`, scoped to `/`, and `Secure` in production. `COOKIE_DOMAIN` can set a shared cookie domain when the API and dashboards use sibling subdomains. Browser clients must send requests with credentials enabled. The API uses `credentials: true` and an exact allow-list made from `ORIGINS_CLIENT_DASHBOARD`, `ORIGINS_CLIENT_LANDING_PAGE`, `ORIGINS_FREELANCER_DASHBOARD`, `ORIGINS_AGENCY_DASHBOARD`, and `ORIGINS_ADMIN_DASHBOARD`; refresh and logout additionally reject a supplied origin outside that list. `API_ALLOWED_ORIGINS` remains supported as a comma-separated compatibility setting. Keep dashboard origins and the API on a compatible site when relying on `SameSite=Strict`.

## Configuration

Required in production:

- `JWT_ACCESS_SECRET`: at least 32 characters; use a randomly generated secret.
- `OTP_HMAC_SECRET`: a separate randomly generated secret of at least 32 characters.
- `ORIGINS_CLIENT_DASHBOARD`, `ORIGINS_CLIENT_LANDING_PAGE`, `ORIGINS_FREELANCER_DASHBOARD`, `ORIGINS_AGENCY_DASHBOARD`, and `ORIGINS_ADMIN_DASHBOARD`: exact browser origins allowed by CORS. `API_ALLOWED_ORIGINS` is also accepted as a comma-separated compatibility setting.
- `DATABASE_URL`: PostgreSQL connection string.
- Email delivery requires `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`. The server verifies SMTP connectivity and authentication during startup and returns `502` when a send is rejected or fails.

Optional settings include `ACCESS_TOKEN_TTL` (default `15m`), `REFRESH_TOKEN_TTL` (default `30d`), `COOKIE_DOMAIN`, and `SUPER_ADMIN_EMAIL`. For Gmail, use an App Password and set `SMTP_FROM` to the same address as `SMTP_USER`. For another SMTP provider, use a sender address authorized by that provider and ensure the sending domain's SPF/DKIM records are configured. Check spam and provider delivery logs if SMTP accepts a message but it does not reach the inbox. `SMTP_SECURE=true` is typically used with port `465`; port `587` typically uses `false`.

## Existing Account Migration

The generated migration normalizes existing email addresses and marks existing rows verified. This is safe for records created by the former identity integration because it inserted an account only after that provider confirmed the email. It leaves `password_hash` null, so existing users must use `/forgot-password` to receive a one-time reset code and set a first-party password. Their account identifier and domain data remain intact.

Before applying the migration, check for case-insensitive duplicate emails:

```sql
SELECT lower(trim(email)) AS normalized_email, count(*)
FROM accounts
GROUP BY lower(trim(email))
HAVING count(*) > 1;
```

Resolve any duplicate identities and confirm which domain records belong to each account before applying the migration; do not automatically merge them. Deploy the migration before deploying the new server code. Remove obsolete identity-provider secrets from deployment configuration. Existing users retain their account role and onboarding/identity-verification flags.

## Integration Tests

The Supertest suite requires a dedicated, disposable PostgreSQL database with the Drizzle migrations already applied. Set `TEST_DATABASE_URL` to that database and run `npm test`. Without it, the integration suite is skipped; it never falls back to `DATABASE_URL`.
