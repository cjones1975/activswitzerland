# Auth: header restyle, email verification, profile email-change

## Overview

Three related changes to the auth flow:
1. Simplify the auth drawer's hero into a plain header (icon + "ActivSwitzerland" title only).
2. Add one-time email verification after register/login: a 5-digit code, Redis-backed with a 5-minute TTL, emailed to the user. This replaces the currently dead `User.isValid` gate — today nothing ever sets `isValid` to `true`, and `register()` issues a full JWT immediately regardless of it. This is one-time, not 2FA-on-every-login: once `isValid` is true, all future logins are password-only.
3. Profile page email-change verification: when a user edits their email, the new address must be verified via the same code mechanism before it's persisted. This requires first wiring `profile.ts` to real `getMe`/`updateUser` calls — it is currently 100% hardcoded with no backend calls at all.

Redis (`redis@6`, already connected via `backend/src/middleware/redis.js`) and email sending (`backend/src/utils/sendEmail.js`, nodemailer/Mailgun) are already fully configured — no new infra/dependencies needed.

## Requirements

### 1. Header restyle
- Collapse `.auth-hero` from the current 200px vertical gradient block (icon circle + title + subtitle, stacked, centered) into a slim horizontal header bar: icon and title side by side, no subtitle.
- Remove the `auth.hero.subtitle` text entirely from the template and from all four locale files (en/de/fr/it).
- Since the header is no longer a tall decorative block, `.auth-card` should sit flush below it instead of overlapping (drop the negative-margin overlap trick).
- Tab bar (Login/Create account) and the benefits list below the card are unaffected.

### 2. Backend verification module
- New `backend/src/utils/verificationCode.js`: generic module reused by both the register/login flow and the profile email-change flow, keyed by `prefix` + `id`.
  - `generateCode()` — 5-digit numeric code via `crypto.randomInt` (not `Math.random`).
  - `createVerificationCode(prefix, id, extra = {})` — stores `{ code, ...extra }` JSON in Redis at `verify:{prefix}:{id}` with a 300s TTL; resets the attempts counter.
  - `verifyAndConsumeCode(prefix, id, submittedCode)` — checks and deletes the code on success; tracks attempts in a companion key (`verify:{prefix}:{id}:attempts`), max 5 wrong attempts before forcing a resend (429); throws a 400 on expired/missing code.
  - If `redisClient.isOpen` is false, throw a 500 rather than silently letting anyone through unverified.
- Register/login flow: `prefix='email-verify'`, `id=email` (lowercased), value `{ code }`.
- Profile email-change flow: `prefix='email-change'`, `id=req.user.id`, value `{ code, newEmail }` — keyed by user id (trusted via `protect`) so the pending new address travels with the code.

### 3. Backend endpoint changes
- `backend/src/middleware/rateLimiter.js` — refactor the single default export into named exports: keep `loginLimiter` as-is, add `verifyLimiter` (10/15min) and `resendLimiter` (3/15min).
- `register` (`backend/src/controllers/auth.js`): if an existing user with that email is found and `!existingUser.isValid`, update that record in place (firstName/lastName/country/password/emailUpdates) instead of erroring — handles "registered but never verified, trying again." Otherwise create as today. Stop calling `sendTokenResponse` — instead generate+email a code and respond `201 { success:true, data:{ email, verificationRequired:true } }` (no token/cookie).
- `login`: in the `!user.isValid` branch, don't rely on `next(new ErrorResponse(...))` — it can't carry extra fields (see Notes). Generate+send a fresh code, then directly respond `403 { success:false, verificationRequired:true, email, err:'Your email is still pending validation. A new code has been sent.' }`.
- New `verifyEmail` (`POST /api/v1/auth/verifyEmail`, public, `verifyLimiter`): body `{ email, code }`. If already valid, skip straight to token issuance (idempotent). Otherwise verify+consume the code, set `isValid = true`, save, then `sendTokenResponse`.
- New `resendVerification` (`POST /api/v1/auth/resendVerification`, public, `resendLimiter`): body `{ email }`. Same not-found handling style as `forgotPassword`. Regenerates+resends.
- `updateUser` (`PUT /api/v1/auth/updateUser`, protected): rewrite to actually apply and return updates. Accepts `firstName/lastName/country/emailUpdates` — apply immediately. If `email` present and different (normalized) from current: check uniqueness (400 if taken elsewhere), do **not** write `user.email` yet — generate+email a code to the **new** address instead, set `emailVerificationPending=true` in the response. Save other fields regardless. Response: `{ success:true, data:user, emailVerificationPending, pendingEmail }`.
- New `verifyEmailChange` (`POST /api/v1/auth/verifyEmailChange`, protected, `verifyLimiter`): body `{ code }`, identity from `req.user.id`. Verify+consume, re-check the new email is still free (race guard), write `user.email`, save, return updated user.
- Wire the two new routes + limiters in `backend/src/routes/auth.js`.

### 4. Frontend service (`frontend/src/app/core/services/auth.ts`)
- Add `readonly pendingVerification = signal<{ email: string } | null>(null)` (public, same pattern as `token`/`isLoggedIn`).
- `register()`: on success, no longer stores a token — sets `pendingVerification` and shows an info toast instead.
- `login()`: on a 403 with `verificationRequired` in the error body, set `pendingVerification` and show an info toast (a fresh code was already sent server-side) instead of the error toast; other error branches unchanged.
- New `verifyEmail(email, code)`, `resendVerification(email)`, `getMe()`, `updateUser(payload)`, `verifyEmailChange(code)` — see backend contracts above for shapes.

### 5. Frontend UI
- New shared component `frontend/src/app/features/auth/verify-code/`: standalone, presentational (`@Input() email`, `@Output() submitCode/resend/cancel`), using PrimeNG `p-inputotp` for 5-digit entry, auto-submit on 5 digits plus an explicit submit button, a "Resend code" link with a short client-side cooldown. Does not call `Auth` itself — hosts wire the callbacks — so it's reusable for both the login/register flow and the profile email-change flow.
- `auth-layout.ts`/`.html`: show `<app-verify-code>` instead of the tab bar/login/register content whenever `auth.pendingVerification()` is set; on submit, call `auth.verifyEmail(...)` then close the `auth` drawer (mirror `Login.onSubmit`'s existing close call).
- `profile.ts`/`.html`: convert the hardcoded `user` object to `user = signal<CurrentUser | null>(null)`, populated via `auth.getMe()` in `ngOnInit`. `saveEdit()` calls `auth.updateUser(...)`; if the response has `emailVerificationPending`, show the `verify-code` component inline (wired to `auth.verifyEmailChange`) instead of just closing edit mode. "Resend" on this screen re-calls `auth.updateUser(...)` with the same pending email rather than needing a separate endpoint.

## Notes

- `ErrorResponse`/`errorHandler` (`backend/src/utils/errorResponse.js`, `backend/src/middleware/error.js`) only ever echo back `{ success:false, err:message }` — they cannot carry extra fields like `verificationRequired`/`email`. Any response that needs those fields must be sent directly via `res.status(...).json(...)`, not via `next(new ErrorResponse(...))`.
- No meaningful unit tests exist today for auth/profile (existing `*.spec.ts` files are unmodified `should create` boilerplate) and the backend has no test runner configured — verify this end-to-end manually rather than adding new test infra, consistent with the rest of this codebase.
- Manual verification checklist: register → receive code → verify → logged in; wrong code 5x → 429 lockout; expired code → 400; re-login on verified account → no code step; re-register before verifying → updates existing record; profile loads real data; edit non-email fields → saves immediately; edit email → code sent to new address, old email persists until verified; verify → email updated; email already in use → 400 before code sent; Redis down → clear 500, no silent bypass.

## References

- @context/screenshots/login.png
- @context/project-overview.md
