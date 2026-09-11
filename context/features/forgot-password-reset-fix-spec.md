# Forgot Password — Reset Flow Fix

## Overview

The "forgot password" flow (@context/features/forgot-pwd-layout-spec.md,
@context/features/forgot-pwd-wireup-spec.md) only ever built the request-a-link half. The email it
sends links to a backend API route that was never registered, so the flow is currently a dead end —
a user who requests a reset gets an email whose link 404s, with no way to actually set a new
password. This spec covers making the existing backend `resetPassword` controller reachable from a
real page, and fixing several real bugs found in it along the way.

**Not a redesign** — this only wires up what's missing/broken. No changes to the request-a-link step
(`features/auth/forgot-password/`) itself.

## Current state (verified in code)

- `backend/src/controllers/auth.js` already has a working `resetPassword` handler and
  `User.js` already has `resetPasswordToken`/`resetPasswordExpire` fields and a
  `getResetPasswordToken()` method — but:
  - `routes/auth.js` never registers a route for it. Only `POST /forgotPassword` is mounted.
  - `forgotPassword`'s emailed `resetUrl` points at the **backend API** origin
    (`${req.protocol}://${req.get('host')}/api/v1/auth/resetpassword/:resettoken`), not the frontend
    — even once routed, this is a link a browser can only `GET`, against an endpoint that's a `POST`.
  - `resetPassword` never checks whether a matching, non-expired user was found before doing
    `user.password = req.body.password` — an invalid or expired token crashes with an unhandled
    `TypeError` instead of returning a real error.
  - The failed-send cleanup path assigns `user.getResetPasswordToken = undefined` (the *method*)
    instead of `user.resetPasswordToken = undefined` (the *field*) — a leftover token/expiry never
    actually gets cleared when the email fails to send.
  - A request for an email that doesn't exist returns `500` with the message `"There is no user with
    email: {email}"`, which the frontend (`Auth.forgotPassword` in `core/services/auth.ts`) surfaces
    verbatim as the toast `auth.toast.forgot_no_user`: **"No user with the provided email was
    found."** — this confirms to anyone probing the form whether an email is registered
    (account-enumeration), and is worth fixing alongside the rest of this flow rather than as a
    separate pass.
- No frontend `reset-password` route, component, or i18n keys exist at all.
- `forgot-password` (the request step) is opened as a **drawer** (`Drawer.open('forgot-password')`),
  not a routed page — fine for that step, since it's reached from inside the app. The reset step
  can't follow the same pattern: it's opened cold from an email link, with no app/drawer context
  loaded yet, so it needs a real routable URL.

## Requirements

### 1. Backend — register the route

- Add `router.post('/resetpassword/:resettoken', resetPassword);` to `backend/src/routes/auth.js`,
  alongside the existing `forgotPassword` line. Public, no `protect` middleware (matches
  `forgotPassword`) — the reset token itself is the credential.

### 2. Backend — point the email at the frontend, not the API

- Change `forgotPassword`'s `resetUrl` to build off `process.env.FRONTEND_URL` (the same env var
  `controllers/billing.js` already uses for its redirect URLs) rather than `req.protocol`/`req.get('host')`:
  `` `${process.env.FRONTEND_URL}/{lang}/reset-password/${resetToken}` `` — see Requirement 5 for why
  a locale prefix is included. `FRONTEND_URL` is already present in both env files (added for
  billing) so no new env var is needed.

### 3. Backend — fix `resetPassword`'s missing user check

- After the `User.findOne({ resetPasswordToken, resetPasswordExpire: { $gt: Date.now() } })` lookup,
  return `next(new ErrorResponse('Invalid or expired reset token', 400))` if no user is found, before
  touching `user.password`. This is the actual crash fix — today a bad/expired/already-used token
  throws instead of failing gracefully.

### 4. Backend — fix the failed-send cleanup typo

- In `forgotPassword`'s `catch` block, change `user.getResetPasswordToken = undefined;` to
  `user.resetPasswordToken = undefined;` so a token is genuinely invalidated when the email fails to
  send, matching the sibling line right below it (`user.resetPasswordExpire = undefined;`).

### 5. Backend — stop leaking whether an email is registered

- Change the "no user found" branch in `forgotPassword` to respond exactly the same way as the
  success path — `res.status(200).json({ success: true, data: 'Email sent' })` — rather than a `500`
  with the email in the message. Whether the address exists should not be observable from the
  response.
- Remove the frontend's `auth.toast.forgot_no_user` handling in `Auth.forgotPassword`
  (`core/services/auth.ts`) — the `err?.status === 500` branch and its toast — since that status/path
  no longer occurs for this endpoint. A genuine server error still falls through to the existing
  generic-error toast.
- i18n: remove the now-unused `auth.toast.forgot_no_user` key from all 5 locale files
  (`frontend/public/i18n/{en,de,fr,it,es}.json`).

### 6. Frontend — new Reset Password page

- New routed (not drawer) page, `features/auth/reset-password/`, mirroring `forgot-password`'s own
  layout conventions (same hero treatment as `auth-layout`, standalone — not nested inside
  `auth-layout` — per @context/features/forgot-pwd-layout-spec.md's precedent for this step):
  - Icon: `<i class="fa-light fa-lock"></i>`. Heading text: "Choose a new password."
  - Reactive form: `password` (required, `Validators.minLength(8)`, matching the register form's
    rule) and `confirmPassword` (required, must match `password`).
  - "Reset password" button, disabled while the form is invalid or a submit is in flight.
  - On success: success toast, then navigate to home with the `auth` drawer opened to the login step
    (mirrors how `verify-code` hands off into a signed-in state) — the backend's `resetPassword`
    already returns a session token via `sendTokenResponse`, so the user can be signed in directly
    rather than sent to log in again; store the returned token the same way `Auth.login` does.
  - On failure (400 invalid/expired token, or any other error): error toast with a message telling
    the user the link may have expired and to request a new one, with a link back to the
    forgot-password step (`Drawer.open('forgot-password')`).

### 7. Frontend — route

- Add `{ path: 'reset-password/:token', loadComponent: ... }` under the existing locale-prefixed
  route group in `app.routes.ts`, alongside `terms-and-conditions`/`privacy-policy` (same tier: a
  real standalone page, not part of the `auth` drawer stack). No `app.routes.server.ts` entry is
  needed beyond whatever the default render mode for that group already is — this page is
  personal/transactional, not indexable content (add it to the same `noindex` grouping
  `trip-planner`/`auth` already use in `app.routes.server.ts`, since a reset-token URL should never
  be crawled or cached).

### 8. Frontend — `Auth` service method

- New `Auth.resetPassword(token: string, password: string): Promise<void>` in `core/services/auth.ts`,
  following the existing method shape (`POST /api/v1/auth/resetpassword/${token}` with
  `{ password }`, store the returned token via the existing private `storeToken`, toast on
  success/failure) — same pattern as `verifyEmail`.

### 9. i18n

- New keys under `auth.*` (mirroring existing naming: `auth.resetPassword.title`,
  `.newPasswordLabel`, `.confirmPasswordLabel`, `.submit`, `auth.toast.reset_success`,
  `.reset_success_detail`, `.reset_failed`, `.reset_expired`), added to all 5 locale files in the
  same pass (en/de/fr/it/es), per existing repo convention.

## Out of scope

- Any change to the request-a-link step's UI, copy, or validation (`features/auth/forgot-password/`).
- Rate-limiting `forgotPassword`/`resetPassword` (neither has a limiter today, matching `register`;
  not addressed here).
- HTML email formatting — `utils/sendEmail.js` only sends plain text today; the reset email stays
  plain text, consistent with every other transactional email in the app.

## References

- @context/features/forgot-pwd-layout-spec.md
- @context/features/forgot-pwd-wireup-spec.md
- @context/features/auth-email-verification-spec.md (precedent for a token-based flow with its own
  drawer/route handoff)
- @context/project-overview.md
