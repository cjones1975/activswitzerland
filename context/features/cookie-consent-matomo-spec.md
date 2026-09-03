# Cookie Consent Banner + Matomo Analytics

## Overview

Today the site sets no non-essential cookies at all — the only cookie is the backend's httpOnly JWT auth cookie (`backend/src/controllers/auth.js`), and the frontend actually authenticates via a `localStorage` token instead (`@frontend/src/app/core/services/auth.ts`). Both are strictly-necessary and require no consent under GDPR/ePrivacy or the Swiss nDSG.

That changes with the planned self-hosted Matomo instance on the NAS: it will use a first-party **cookie-based** visitor tracker (not the cookieless mode), which is a non-essential analytics cookie. This spec takes the stricter EU opt-in-before-tracking reading (compliant under both EU and Swiss law) rather than branching consent behavior by visitor geography.

Two pieces:

1. A consent banner + a durable "Cookie Settings" entry point so a choice can be changed later, plus a Privacy Policy page disclosing what's actually collected (auth cookie/token, Matomo if accepted, Redis server-side caching, and the two existing third-party requests — Font Awesome kit script, OpenFreeMap map tiles).
2. A Matomo tracking service, gated on consent, that fires SPA pageviews manually on route change (this is a client-routed Angular app — Matomo's default script only tracks the initial page load).

Matomo's JS tracker has a built-in consent-gating API (`requireConsent` / `setConsentGiven` / `forgetConsentGiven`) designed for exactly this, so the tracker script itself is safe to load unconditionally — no request/data is actually sent until consent is granted.

The actual NAS Matomo URL and site ID aren't known yet (that install is a separate, not-yet-done infra task) — this spec wires the frontend to consume them via environment config, landing on placeholders until that instance exists.

---

## 1. Consent state — `frontend/src/app/shared/services/cookie-consent.ts` (new)

Signal-based service, `isPlatformBrowser`-guarded the same way `Auth` reads `localStorage` (`@frontend/src/app/core/services/auth.ts:57,59`):

```typescript
@Injectable({ providedIn: 'root' })
export class CookieConsent {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private matomo = inject(Matomo);

  status = signal<'accepted' | 'rejected' | null>(
    this.isBrowser ? (localStorage.getItem('cookie-consent') as 'accepted' | 'rejected' | null) : null
  );

  /** Opened from the banner's first-visit state AND from the menu-nav "Cookie Settings" entry. */
  showPreferences = signal(false);

  accept(): void {
    this.setStatus('accepted');
    this.matomo.setConsent(true);
  }

  reject(): void {
    this.setStatus('rejected');
    this.matomo.setConsent(false);
  }

  private setStatus(status: 'accepted' | 'rejected'): void {
    this.status.set(status);
    this.showPreferences.set(false);
    if (this.isBrowser) localStorage.setItem('cookie-consent', status);
  }
}
```

---

## 2. Matomo tracking — `frontend/src/app/shared/services/matomo.ts` (new)

```typescript
@Injectable({ providedIn: 'root' })
export class Matomo {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private router = inject(Router);
  private doc = inject(DOCUMENT);

  init(): void {
    if (!this.isBrowser || !environment.matomoUrl) return;

    const w = window as any;
    w._paq = w._paq || [];
    w._paq.push(['requireConsent']);
    w._paq.push(['setTrackerUrl', `${environment.matomoUrl}/matomo.php`]);
    w._paq.push(['setSiteId', environment.matomoSiteId]);

    const script = this.doc.createElement('script');
    script.async = true;
    script.src = `${environment.matomoUrl}/matomo.js`;
    this.doc.head.appendChild(script);

    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e) => {
        w._paq.push(['setCustomUrl', (e as NavigationEnd).urlAfterRedirects]);
        w._paq.push(['setDocumentTitle', this.doc.title]);
        w._paq.push(['trackPageView']);
      });
  }

  setConsent(granted: boolean): void {
    if (!this.isBrowser) return;
    (window as any)._paq?.push([granted ? 'setConsentGiven' : 'forgetConsentGiven']);
  }
}
```

Route-change tracking mirrors the `NavigationEnd` pattern already used in `@frontend/src/app/shell/footer-nav/footer-nav.ts:23-30`.

`@frontend/src/app/app.ts`: call `inject(Matomo).init()` alongside the existing `inject(SeoService).setWebsite()` call, and call `inject(CookieConsent)` once so its signal is constructed (reads stored choice, applies it):

```typescript
constructor() {
  inject(SeoService).setWebsite();
  inject(Matomo).init();
  const consent = inject(CookieConsent);
  if (consent.status()) this.matomo.setConsent(consent.status() === 'accepted');
}
```

---

## 3. Consent banner — `frontend/src/app/shell/cookie-consent-banner/` (new)

`cookie-consent-banner.ts` / `.html` / `.css`, mounted directly in `app.html` next to `p-toast`:

```html
<p-toast .../>
<app-cookie-consent-banner />
<router-outlet />
```

Visible when `consent.status() === null || consent.showPreferences()`. Fixed bottom bar (same visual register as the existing bottom footer-nav), two actions:

- **Accept** → `consent.accept()`
- **Decline** → `consent.reject()`

No granular per-category toggle needed in the banner itself — there's exactly one non-essential category (Analytics), so accept/decline covers it. A link inside the banner ("Privacy Policy") routes to the new legal page.

---

## 4. "Cookie Settings" entry point — `menu-nav`

`@frontend/src/app/shell/menu-nav/menu-nav.html`: new `nav-section` (mirrors the existing `nav-section`/`nav-item` markup at lines 1–30), placed after the main navigation section:

```html
<section class="nav-section">
    <span class="nav-label">{{ 'nav.legal' | translate }}</span>
    <ul class="nav-list">
        <li class="nav-item" [routerLink]="langSvc.localize(['privacy-policy'])" (click)="closeMenu()">
            <div class="nav-icon-box"><i class="fa-light fa-shield-halved"></i></div>
            <span class="nav-item-label">{{ 'nav.privacyPolicy' | translate }}</span>
            <i class="pi pi-chevron-right nav-chevron"></i>
        </li>
        <li class="nav-item" (click)="openCookieSettings()">
            <div class="nav-icon-box"><i class="fa-light fa-cookie-bite"></i></div>
            <span class="nav-item-label">{{ 'nav.cookieSettings' | translate }}</span>
            <i class="pi pi-chevron-right nav-chevron"></i>
        </li>
    </ul>
</section>
```

`menu-nav.ts`: inject `CookieConsent`, add:

```typescript
openCookieSettings(): void {
  this.closeMenu();
  this.consent.showPreferences.set(true);
}
```

Reopening shows the same banner component (step 3) with its current stored choice pre-selected — no separate dialog component needed given there's only one toggle.

---

## 5. Privacy Policy page — `frontend/src/app/features/legal/privacy-policy/` (new)

Static, translated content component (`PrivacyPolicy`), added to `@frontend/src/app/app.routes.ts` as a `loadComponent` route alongside the other `:lang` children (pattern at lines 21–45):

```typescript
{
  path: 'privacy-policy',
  loadComponent: () => import('./features/legal/privacy-policy/privacy-policy').then(m => m.PrivacyPolicy),
},
```

Content sections, driven by `i18n` keys (see §6): what's collected and why —

- Authentication (httpOnly cookie + localStorage token) — strictly necessary, always active.
- Trip-planner draft (`sessionStorage`) — strictly necessary, cleared per session.
- Analytics (Matomo) — only active if accepted; self-hosted, first-party, name the NAS/domain once known.
- Server-side caching (Redis) — MySwitzerland API response cache keyed by request URL, not personal data.
- Third-party requests: Font Awesome kit script (`frontend/src/index.html:9`) and OpenFreeMap map tiles (`@frontend/src/app/shared/map/map.ts:46`) — both contacted directly by the browser regardless of consent choice (they're required for the page to render, not analytics), disclosed for transparency since they see the visitor's IP.

---

## 6. i18n — `frontend/public/i18n/{en,de,fr,it}.json`

Add, in the same pass across all four locale files per usual convention:

```json
"nav": {
  "legal": "LEGAL",
  "privacyPolicy": "Privacy Policy",
  "cookieSettings": "Cookie Settings"
},
"cookieConsent": {
  "message": "We use cookies for essential site functionality and, with your consent, to understand how visitors use ActivSwitzerland via our self-hosted analytics.",
  "accept": "Accept",
  "decline": "Decline",
  "privacyPolicyLink": "Privacy Policy"
},
"legal": {
  "privacyPolicy": {
    "title": "Privacy Policy",
    ...
  }
}
```

Legal copy carries liability that ordinary UI strings don't — draft the German/French/Italian legal text at implementation time and flag it for a native-speaker or legal review pass before shipping, unlike routine copy edits.

---

## 7. Environment config

`@frontend/src/environments/environment.ts` (dev — disabled):

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
  matomoUrl: '',
  matomoSiteId: '',
};
```

`@frontend/src/environments/environment.prod.ts` (placeholders until the NAS instance exists):

```typescript
export const environment = {
  production: true,
  apiUrl: '',
  matomoUrl: '', // TODO: set once Matomo is deployed on the NAS, e.g. https://analytics.activswitzerland.com
  matomoSiteId: '', // TODO: Matomo site ID once created
};
```

`Matomo.init()` no-ops when `matomoUrl` is empty, so the banner never appears and no third-party request happens until this is filled in — dev stays exactly as it is today.

---

## Out of Scope

- No CSP/`helmet` headers exist in the backend today (none found) — nothing to allowlist yet. Revisit if CSP is added later, since Matomo's script origin would need adding.
- No IAB TCF or ad-consent framework — one Analytics category only, no ad tech planned.
- No per-visitor geography branching (EU vs. Swiss consent rules) — the stricter EU opt-in gate is used everywhere.
- No changes to the existing auth cookie/token or the trip-planner `sessionStorage` draft — those stay strictly-necessary and undisclosed-consent-required, only newly *documented* in the Privacy Policy.
- NAS-side Matomo install and reverse-proxy/domain setup is a separate infra task — this spec only wires the frontend to consume a URL/site ID once that exists.
- No Impressum page — add only if legal review determines Swiss/DACH law requires one for this site; not addressed here.

---

## Verification

- Dev (`matomoUrl` unset): confirm the banner never renders and no request to any Matomo host occurs, network tab clean.
- Once a real `matomoUrl`/`matomoSiteId` is set: first visit shows the banner; confirm no `trackPageView` calls reach Matomo before a choice is made.
- Click Accept: confirm `setConsentGiven` fires and subsequent in-app route changes (no full reload) show up as pageviews in Matomo's real-time log.
- Click Decline: confirm no analytics events fire and `localStorage['cookie-consent'] === 'rejected'`.
- Reload after choosing either way: banner does not reappear; choice persists.
- Open "Cookie Settings" from the menu after already choosing: banner reappears, choice can be flipped, and flipping Accept → Decline calls `forgetConsentGiven`.

---

## References

- @frontend/src/app/app.html
- @frontend/src/app/app.ts
- @frontend/src/app/app.routes.ts
- @frontend/src/app/shell/menu-nav/menu-nav.html
- @frontend/src/app/shell/menu-nav/menu-nav.ts
- @frontend/src/app/shell/footer-nav/footer-nav.ts (NavigationEnd pattern reference)
- @frontend/src/app/core/services/auth.ts (isPlatformBrowser + localStorage pattern reference)
- @frontend/src/environments/environment.ts
- @frontend/src/environments/environment.prod.ts
- @frontend/public/i18n/en.json
- @frontend/public/i18n/de.json
- @frontend/public/i18n/fr.json
- @frontend/public/i18n/it.json
- @frontend/src/index.html
- @frontend/src/app/shared/map/map.ts
- @backend/src/controllers/auth.js
- @backend/src/middleware/cache.js
- @frontend/src/app/shared/services/cookie-consent.ts (new)
- @frontend/src/app/shared/services/matomo.ts (new)
- @frontend/src/app/shell/cookie-consent-banner/ (new)
- @frontend/src/app/features/legal/privacy-policy/ (new)
