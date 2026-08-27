# Terms Acceptance + Legal Pages

## Overview

Two things, decided over the course of drafting `context/legal/ActivSwitzerland Terms
and Conditions.docx`:

1. Passive availability of the Terms isn't enough evidence of assent for a
   contract-forming action (account creation, subscription purchase) — a
   "browsewrap" link is fine for anonymous browsing but weak if ever disputed.
   Account creation needs an explicit, un-pre-checked opt-in, recorded with a
   timestamp and version, mirroring how `emailUpdates` already works on the
   register form.
2. The site has no footer and the user doesn't want to add one. Legal links go
   in the `menu-nav` drawer instead, below the language selector.

This spec covers: the register-form consent toggle + backend enforcement/
recording, the two new static legal pages, and the nav-menu links to them.

**Content decision:** the live Terms & Conditions page uses the content from
`context/legal/ActivSwitzerland Terms and Conditions.docx` (the fuller,
23-section version), not the thinner `context/legal/terms-and-conditions-draft.md`
stub. Confirmed with the user.

The live Privacy Policy page uses the content from
`context/legal/ActivSwitzerland Privacy Policy.docx` (16 sections — Introduction
through Contact). That doc originally shipped with a numbering gap (§13 was
deleted, jumping from §12 straight to §14); it's since been fixed in place —
§13 "Children's Privacy" was added back (anchored to the existing 18+
account-creation rule in the Terms' §3, not a separate/lower age threshold —
minors can still use the parts of the Service that don't require an account),
and a copy-paste leftover in §14 ("changes to these Terms" → "changes to this
Policy") was corrected.

---

## 1. Backend — `backend/src/models/User.js`

Add two fields alongside the existing audit-style fields (`resetPasswordToken`,
`resetPasswordExpire`), same `select: false` treatment since nothing in the
frontend needs to read these back today:

```js
termsAcceptedAt: {
    type: Date,
    select: false
},
termsVersion: {
    type: String,
    select: false
},
```

## 2. Backend — `backend/src/controllers/auth.js`

Add a version constant near the top of the file (matches the docx's "Last
updated" date — bump this string whenever the published Terms materially
change, per the docx's own §19):

```js
const TERMS_VERSION = '2026-08-26';
```

In `register`:

- Add `termsAccepted` to the destructured `req.body`.
- Reject with 400 if `termsAccepted !== true`, alongside the existing
  required-fields check: `'You must accept the Terms and Conditions and Privacy Policy'`.
- On both the "new user" `User.create(...)` path and the "previously
  registered but unverified" update-in-place path, set:
  ```js
  termsAcceptedAt: new Date(),
  termsVersion: TERMS_VERSION,
  ```

No changes needed to `login`, `verifyEmail`, or `updateUser` — acceptance is
captured once, at registration, consistent with how the docx frames it
("creating an account... constitutes agreement").

## 3. Frontend — `frontend/src/app/core/services/auth.ts`

Add `termsAccepted: boolean` to the `RegisterPayload` interface and pass it
through in `register()` unchanged (it already spreads/forwards the payload
object as-is to the POST body).

## 4. Frontend — `frontend/src/app/features/auth/register/register.ts`

- Add a form control: `termsAccepted: [false, Validators.requiredTrue]`. This
  makes `form.invalid` true (and the submit button disabled, via the existing
  `[disabled]="form.invalid || submitting()"` binding) until the user
  explicitly toggles it on — satisfies "account cannot be created until
  accepted" without extra submit-time branching.
- Inject `LangService` (as `protected langSvc`, matching `menu-nav.ts`'s
  pattern) so the template can build locale-prefixed links to the two legal
  pages.
- Include `termsAccepted` in the destructured `getRawValue()` call in
  `onSubmit()` and pass it through to `auth.register(...)`.

## 5. Frontend — `frontend/src/app/features/auth/register/register.html`

New block directly below the existing `.newsletter-card` block, same
toggle-switch pattern the user asked for:

```html
<div class="consent-card">
    <div class="consent-text">
        <span class="consent-title">{{ 'auth.terms.title' | translate }}</span>
        <span class="consent-sub">
            {{ 'auth.terms.prefix' | translate }}
            <a class="consent-link" [routerLink]="langSvc.localize(['terms-and-conditions'])" target="_blank" rel="noopener">{{ 'nav.termsAndConditions' | translate }}</a>
            {{ 'auth.terms.and' | translate }}
            <a class="consent-link" [routerLink]="langSvc.localize(['privacy-policy'])" target="_blank" rel="noopener">{{ 'nav.privacyPolicy' | translate }}</a>
        </span>
    </div>
    <p-toggleswitch formControlName="termsAccepted" />
</div>
```

`target="_blank"` is deliberate: Register lives inside the `auth` drawer
(`auth-layout.ts`), so an in-place navigation to a legal page would close the
drawer and lose whatever the user has already typed into the form. Opening in
a new tab keeps the in-progress registration intact. The nav-menu links (§7)
don't have this problem — they're plain navigation, not inside a form — so
they navigate normally.

`register.ts` needs `RouterLink` added to its `imports` array for this.

## 6. Frontend — `frontend/src/app/features/auth/register/register.css`

Rather than duplicating the newsletter-card rules, extend the existing
selectors to cover both class names (purely visual card, not
newsletter-specific):

```css
.newsletter-card,
.consent-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--gray-50);
    border: 1px solid var(--gray-200);
    border-radius: 10px;
    padding: 0.85rem 1rem;
    margin-bottom: 1.25rem;
}

.newsletter-text,
.consent-text {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
}

.newsletter-title,
.consent-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--gray-900);
}

.newsletter-sub,
.consent-sub {
    font-size: 0.78rem;
    color: var(--gray-500);
}

.consent-link {
    color: var(--navy-500);
    text-decoration: underline;
}
```

(Replaces the current single-purpose `.newsletter-*` rule blocks in place —
same declarations, just shared selectors.)

## 7. Frontend — `frontend/src/app/shell/menu-nav/menu-nav.html`

New section, placed after `.lang-selector` (which has `margin-top: auto` and
therefore already sits at the bottom of the drawer — the new links go directly
beneath it, still in normal flow):

```html
<div class="legal-links">
    <a [routerLink]="langSvc.localize(['terms-and-conditions'])" (click)="closeMenu()">{{ 'nav.termsAndConditions' | translate }}</a>
    <span class="legal-sep">·</span>
    <a [routerLink]="langSvc.localize(['privacy-policy'])" (click)="closeMenu()">{{ 'nav.privacyPolicy' | translate }}</a>
</div>
```

`menu-nav.ts` already has `RouterLink` in its `imports` (used on the nav-item
`routerLink` bindings via property binding, not the directive form — needs
confirming `RouterLink` is actually imported; the existing `[routerLink]`
bindings on `<li>` elements work today so it already is).

`menu-nav.css` — small addition:

```css
.legal-links {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    padding-top: 0.75rem;
    font-size: 0.75rem;
}

.legal-links a {
    color: var(--gray-500);
    text-decoration: none;
}

.legal-links a:hover {
    text-decoration: underline;
}

.legal-sep {
    color: var(--gray-300);
}
```

## 8. New pages — `frontend/src/app/features/legal/`

Two new standalone components, following the `hotels-stub` pattern (simplest
existing static-content component) rather than anything data-driven:

- `frontend/src/app/features/legal/terms-and-conditions/terms-and-conditions.{ts,html,css}`
- `frontend/src/app/features/legal/privacy-policy/privacy-policy.{ts,html,css}`

**Content approach — deliberately not i18n-driven, unlike routine UI copy.**
This follows the precedent already set in `cookie-consent-matomo-spec.md`
("Legal copy carries liability that ordinary UI strings don't — draft the
German/French/Italian legal text at implementation time and flag it for a
native-speaker or legal review pass before shipping, unlike routine copy
edits"). Concretely: the page body content is hardcoded English HTML in the
template (not `| translate` keys), with a short note at the top of each page
("Currently available in English only"). The short nav labels that link to
these pages (`nav.termsAndConditions`, `nav.privacyPolicy`, `nav.legal`, and
the register consent sentence `auth.terms.*`) ARE routine UI copy and get
translated into all five locales as usual — only the legal document bodies
themselves stay English-only pending a real translation/legal-review pass.

**Terms & Conditions page content:** the full text of
`context/legal/ActivSwitzerland Terms and Conditions.docx` (23 sections — About
These Terms, through Contact), converted to semantic HTML (`<h2>` per
numbered section, `<p>`/`<ul>` for body). The docx's §13 placeholder
`[insert Privacy Policy link]` becomes a real `routerLink` to the new Privacy
Policy page. The docx's Contact section (§23) stays as-is — email only, no
street address, matching the user's decision not to expose a personal
address; revisit if/when a PO Box or virtual-office address is set up.

**Privacy Policy page content:** the full text of
`context/legal/ActivSwitzerland Privacy Policy.docx` (16 sections —
Introduction through Contact, including §13 Children's Privacy), converted to
semantic HTML the same way as the Terms page (`<h2>` per numbered section,
`<p>`/`<ul>` for body). §1's reference to "the ActivSwitzerland Terms and
Conditions" becomes a real `routerLink` to the Terms page, mirroring the
cross-link the other direction. Already covers what matters given what's
actually shipped: account data collected at registration, AI chat
conversations going to a third-party AI provider (kept generic, not naming
Anthropic — same choice the Terms doc makes), Stripe as payment processor
with no card data stored locally, technical/cookie data, international
transfers, retention, and Swiss nDSG/GDPR-style user rights. It supersedes
the section outline in `cookie-consent-matomo-spec.md` §5 (that outline was
written before account creation, AI chat, and Stripe billing existed) — the
cookie-consent spec's own Matomo/cookie-banner mechanics are still a separate
not-yet-built piece (see Out of Scope), this page's content just already
accounts for cookies/localStorage generally via its own §3.6.

**Routing** — `frontend/src/app/app.routes.ts`, alongside the other `:lang`
children (pattern at lines 20-50):

```typescript
{
  path: 'terms-and-conditions',
  loadComponent: () => import('./features/legal/terms-and-conditions/terms-and-conditions').then(m => m.TermsAndConditions),
},
{
  path: 'privacy-policy',
  loadComponent: () => import('./features/legal/privacy-policy/privacy-policy').then(m => m.PrivacyPolicy),
},
```

(`privacy-policy` was already planned at this exact path in
`cookie-consent-matomo-spec.md` §5 — that spec's route entry is superseded by
this one, same path, so its own future implementation doesn't need to
re-add it.)

---

## 9. i18n — `frontend/public/i18n/{en,de,fr,it,es}.json`

Routine UI copy, translated into all five locales in the same pass per usual
convention:

```json
"nav": {
  "legal": "Legal",
  "termsAndConditions": "Terms & Conditions",
  "privacyPolicy": "Privacy Policy"
},
"auth": {
  "terms": {
    "title": "Terms & Conditions",
    "prefix": "I agree to the",
    "and": "and"
  }
}
```

(`nav.privacyPolicy` doesn't exist yet in `en.json` today — only
`cookie-consent-matomo-spec.md` planned it, unimplemented. `nav.legal` same
situation.)

---

## Out of Scope

- Translating the actual Terms/Privacy body content into de/fr/it/es —
  explicitly deferred pending native-speaker/legal review, per the existing
  cookie-consent-spec precedent.
- The cookie-consent banner and Matomo wiring itself
  (`cookie-consent-matomo-spec.md`) — separate, not-yet-implemented spec;
  this one only reuses/finalizes its planned Privacy Policy route and content
  outline.
- Re-prompting existing users (there are presumably few/none pre-launch) to
  accept Terms retroactively — `termsAcceptedAt`/`termsVersion` start being
  recorded going forward from this change; no backfill migration.
- A re-accept gate for when the Terms are next materially revised — worth
  building once there's a real user base and a real second revision to gate,
  not speculatively now.
- Business address / Impressum resolution — separate decision (PO Box /
  virtual office), not blocking this change since the Contact section doesn't
  currently expose one either way.
- Incorporation (sole trader vs. GmbH) — unrelated, separate future decision.

---

## Verification

- Register form: submit button stays disabled until both the toggle is on
  *and* the rest of the form is valid; toggling on/off updates `form.invalid`
  live.
- Submitting with the toggle off is impossible via the UI; confirm the
  backend also rejects a direct POST without `termsAccepted: true` (400, not
  a silent pass) — belt-and-braces since the frontend guard alone isn't
  trustworthy for an unauthenticated public endpoint.
- After a successful registration, confirm the `User` document has
  `termsAcceptedAt` set and `termsVersion` equal to `TERMS_VERSION` (fields
  are `select: false`, so check via a direct DB query, not the API response).
- Clicking a Terms/Privacy link from inside the register form opens a new tab
  and leaves the in-progress registration form (and drawer) untouched.
- Clicking the same links from the menu-nav drawer navigates in place and
  closes the drawer, consistent with the other nav-item links.
- Both legal pages render under `/{lang}/terms-and-conditions` and
  `/{lang}/privacy-policy` for all five locale prefixes (content itself stays
  English per the decision above; only the surrounding chrome is localized).

---

## References

- @context/legal/ActivSwitzerland Terms and Conditions.docx (canonical Terms content)
- @context/legal/ActivSwitzerland Privacy Policy.docx (canonical Privacy Policy content)
- @context/legal/terms-and-conditions-draft.md (superseded stub, not used)
- @context/features/cookie-consent-matomo-spec.md (prior Privacy Policy route/outline plan, superseded route entry and content outline)
- @frontend/src/app/features/auth/register/register.ts
- @frontend/src/app/features/auth/register/register.html
- @frontend/src/app/features/auth/register/register.css
- @frontend/src/app/core/services/auth.ts
- @backend/src/models/User.js
- @backend/src/controllers/auth.js
- @frontend/src/app/shell/menu-nav/menu-nav.html
- @frontend/src/app/shell/menu-nav/menu-nav.ts
- @frontend/src/app/shell/menu-nav/menu-nav.css
- @frontend/src/app/features/hotels/hotels-stub/ (static-page component pattern reference)
- @frontend/src/app/app.routes.ts
- @frontend/src/app/features/auth/auth-layout/auth-layout.ts (confirms Register renders inside the `auth` drawer)
- @frontend/public/i18n/en.json
- @frontend/public/i18n/de.json
- @frontend/public/i18n/fr.json
- @frontend/public/i18n/it.json
- @frontend/public/i18n/es.json
- @frontend/src/app/features/legal/terms-and-conditions/ (new)
- @frontend/src/app/features/legal/privacy-policy/ (new)
