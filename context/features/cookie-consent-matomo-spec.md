# Matomo Analytics (Cookieless) + Conversion Events

> **Revised 2026-10-09.** The original version of this spec paired a cookie-based Matomo tracker with a consent banner. Replaced with Matomo's **cookieless** mode, which needs no banner, plus event tracking on the actions that make money. Reasons: (1) a consent banner typically loses a large share of visitors' data, (2) the Privacy Policy page and the menu's legal links have since shipped (Terms Acceptance + Legal Pages, 2026-08-27), so those sections were obsolete, and (3) Cloudflare analytics turned out to be dominated by bot traffic (see `mys-bot-traffic-resilience-spec.md`) and can't show real-visitor behaviour at all. The filename is kept because `current-feature.md` references it.

## Overview

Cloudflare's dashboard counts every request at the edge: bots, assets, API calls. It can't answer the questions that matter for ActivSwitzerland: how many real people visit, where they come from (search, referrers), which destinations they look at, and which pages lead to the three revenue actions (Booking.com hotel link, GetYourGuide experiences, Pro subscription).

Self-hosted Matomo, run **without cookies**, answers those. It's configured to qualify for the audience-measurement consent exemption accepted by EU regulators (CNIL-style criteria) and compatible with the Swiss nDSG. The conditions this spec has to meet:

- no cookies or other persistent identifiers on the device (`disableCookies`);
- IP addresses anonymised and data used only for first-party audience measurement, not shared or cross-site;
- limited retention;
- a clear Privacy Policy disclosure with a way to opt out.

So **no consent banner and no "Cookie Settings" entry are needed**. Legal confirmation is still recommended before launch (see §7).

Two pieces:

1. A `Matomo` frontend service that loads the tracker in cookieless mode, tracks SPA page views (it's a client-routed Angular app, so Matomo's default script only sees the first load), and exposes `trackEvent()`.
2. Events on the revenue and engagement actions, plus a Privacy Policy update with an opt-out toggle.

The NAS-side Matomo install is a separate infra task (§6 lists the settings it must use). The frontend reads the URL and site ID from environment config and does nothing while they're empty.

---

## 1. Tracking service — `frontend/src/app/shared/services/matomo.ts` (new)

```typescript
const OPT_OUT_KEY = 'analytics-opt-out';

@Injectable({ providedIn: 'root' })
export class Matomo {
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private router = inject(Router);
  private doc = inject(DOCUMENT);
  private seo = inject(SeoService);
  private enabled = false;

  init(): void {
    if (!this.isBrowser || !environment.matomoUrl || this.isOptedOut()) return;
    // Automation frameworks (headless Chrome, Puppeteer, Playwright) set navigator.webdriver —
    // cheap first filter for the JS-running scrapers that Matomo's own bot list misses.
    if (navigator.webdriver) return;

    const w = window as any;
    w._paq = w._paq || [];
    w._paq.push(['disableCookies']);
    w._paq.push(['setDoNotTrack', true]);
    w._paq.push(['enableLinkTracking']);
    w._paq.push(['setTrackerUrl', `${environment.matomoUrl}/matomo.php`]);
    w._paq.push(['setSiteId', environment.matomoSiteId]);

    const script = this.doc.createElement('script');
    script.async = true;
    script.src = `${environment.matomoUrl}/matomo.js`;
    this.doc.head.appendChild(script);
    this.enabled = true;

    this.trackPageViews();
  }

  trackEvent(category: string, action: string, name?: string, value?: number): void {
    if (!this.enabled) return;
    (window as any)._paq.push(['trackEvent', category, action, name, value].filter(v => v !== undefined));
  }

  isOptedOut(): boolean {
    try { return localStorage.getItem(OPT_OUT_KEY) === '1'; } catch { return false; }
  }

  /** Privacy Policy opt-out toggle. Opting out stops tracking immediately; opting back in takes effect on next load. */
  setOptOut(optOut: boolean): void {
    try { optOut ? localStorage.setItem(OPT_OUT_KEY, '1') : localStorage.removeItem(OPT_OUT_KEY); } catch { /* storage blocked: nothing to persist */ }
    if (optOut) this.enabled = false;
  }
}
```

**Opt-out storage.** The opt-out flag lives in `localStorage` and is set only when the visitor asks for it. That's the "stored at the user's request" exception, so it doesn't undermine the cookieless basis. Matomo's own `optUserOut` is deliberately **not** used: it relies on a cookie.

**Page views and titles (`trackPageViews`).** `NavigationEnd` fires before the page's data has loaded. A destination page only gets its real title once `getDestination` returns and `SeoService.set()` runs, so tracking immediately would record placeholder titles.
- After each `NavigationEnd`, wait for the next `SeoService.set()` call or 1.5s, whichever comes first, then push `setReferrerUrl` (the previous URL), `setCustomUrl` (`urlAfterRedirects`), `setDocumentTitle` and `trackPageView`.
- `SeoService` needs a small hook for this: a `titleSet$` `Subject` emitted from `set()`.
- The initial navigation also produces a `NavigationEnd`, so `init()` must not fire its own first page view (it would double-count).

`@frontend/src/app/app.ts`: call `inject(Matomo).init()` next to the existing `inject(SeoService).setWebsite()`.

Route-change tracking follows the `NavigationEnd` pattern in `@frontend/src/app/shell/footer-nav/footer-nav.ts`.

---

## 2. Events

Each one is a single `matomo.trackEvent(...)` call at an existing call site:

| Category | Action | Name | Where |
|---|---|---|---|
| `Hotels` | `Booking.com click` | destination identifier | `features/hotels/hotel-search/hotel-search.ts` `search()`, in `next:` just before `window.open(url, …)` |
| `Experiences` | `See more` | destination identifier | `features/destinations/destination-detail/destination-detail.ts` `openExperiences()` |
| `Experiences` | `GetYourGuide link` | GYG location id | `features/experiences/gyg-activities/gyg-activities.html`: `(click)` on the "Powered by GetYourGuide" `<a>` |
| `Subscription` | `Checkout started` | `monthly` / `yearly` | `shared/services/billing.ts` `startCheckout()`, before the redirect. This covers both callers (`profile`, `ai-chat-drawer`) |
| `Subscription` | `Checkout completed` | — | `features/auth/profile/profile.ts`, where it already detects `?checkout=success` |
| `Trip` | `Saved` / `Updated` | `public` / `private` | `features/trip-planner/step5-save/step5-save.ts` `save()` success handler (`id` present means `Updated`) |

In Matomo, set up **Goals** on the `Hotels`, `Experiences` and `Subscription` events. The Goals reports then show conversion rate by entry page, referrer and destination.

**GetYourGuide limit:** bookings made *inside* the GYG widget can't be tracked. It's GYG's cross-origin iframe, and its clicks never reach our page. GYG's partner dashboard reports those bookings. On our side Matomo can only see interest (`See more`, outbound link).

`enableLinkTracking` (§1) also records outbound clicks (e.g. the myswitzerland.com attribution links) and downloads (GPX exports) automatically.

---

## 3. Privacy Policy — `frontend/src/app/features/legal/privacy-policy/privacy-policy.html`

The page already exists, is English-only (`legal-lang-note`), and currently says generically that cookies "may be used" with "our cookie-consent mechanism". Update it to describe what actually happens:

- **§3.6 Cookies and Similar Technologies:** state that ActivSwitzerland sets no analytics or advertising cookies. The only persistent items are strictly necessary: the sign-in token/cookie and the trip-planner draft (`sessionStorage`), plus the opt-out flag if the visitor sets one. Remove the reference to a "cookie-consent mechanism".
- **"Analytics and technical service providers":** name Matomo, self-hosted by us in Switzerland (on the NAS), cookieless, IP addresses anonymised (2 bytes), no cross-site tracking, not shared with third parties, raw data deleted after the retention period in §6. Note that browser "Do Not Track" is honoured.
- **Opt-out control:** a short paragraph with a toggle button bound to `Matomo.isOptedOut()` / `setOptOut()`, labelled "Exclude my visits from analytics" / "Include my visits in analytics". English-only like the rest of the page, so no i18n keys are needed.
- **Third parties contacted by the browser** (transparency, since they see the visitor's IP): Font Awesome kit, OpenFreeMap tiles, and **GetYourGuide** (widget on destination pages, which loads its own scripts). See §7 for the GYG question.

---

## 4. Environment config

`@frontend/src/environments/environment.ts` (dev: disabled):

```typescript
matomoUrl: '',
matomoSiteId: '',
```

`@frontend/src/environments/environment.prod.ts`:

```typescript
matomoUrl: '', // TODO: e.g. https://analytics.activswitzerland.com once deployed
matomoSiteId: '', // TODO: site ID from the Matomo install
```

These are added alongside the existing `apiUrl`/`gygPartnerId` keys. `init()` does nothing while `matomoUrl` is empty, so dev and SSR behave exactly as today.

---

## 5. SSR and caching

- `init()` only runs in the browser (`isPlatformBrowser`), so nothing changes for server rendering.
- Cloudflare edge-caches destination HTML (Cache Rule, 4h). That's fine: the tracker runs in the visitor's browser, so cached pages are still counted.
- The tracker host (`analytics.activswitzerland.com`) must **not** match the `/destinations/` Cache Rule, and must not be cached by Cloudflare at all.

---

## 6. Matomo server settings (infra task — required for the consent-free basis)

The install itself (Matomo + MariaDB containers on the NAS, `analytics.activswitzerland.com` via Cloudflare) is separate from this frontend work. Whoever does it must apply these settings, because the no-banner approach depends on them:

- **Privacy → Anonymize data:** IP anonymisation **2 bytes**, also applied to stored data; anonymise referrers if they contain query parameters.
- **Privacy → Delete old raw data:** raw visit logs deleted after **13 months** (aggregated reports can be kept).
- **Privacy → Users opt-out / Do Not Track:** "Support Do Not Track" enabled.
- **No integrations** that share data with third parties: no ad networks, no cross-site linking.
- **Archiving:** turn off browser-triggered archiving and run `core:archive` from a cron job. The NAS is modest hardware.
- **Bots:** Matomo's built-in bot detection stays on. Add user-agent exclusions for `HeadlessChrome` and other obvious automation, which complements the `navigator.webdriver` check in §1.

---

## 7. Open questions (decide before or at launch)

- **Legal confirmation:** cookieless Matomo with the settings above is widely treated as exempt from consent under EU guidance and the Swiss nDSG. That's a regulatory interpretation, not a guarantee, so a quick legal check is worth doing.
- **GetYourGuide:** the GYG widget loads GetYourGuide's own scripts, which may set third-party cookies. That's independent of Matomo. Earlier history notes `GygService.ensureScript()` "must be gated on consent" if a banner is ever introduced. Removing the banner from this spec doesn't settle the GYG question: decide separately whether GYG needs consent gating, or whether disclosing it in the Privacy Policy is enough.

---

## Out of Scope

- A consent banner or "Cookie Settings" entry. Not needed for cookieless Matomo; revisit only if §7's GYG decision requires consent.
- CSP headers: none exist today. If CSP is added later, allow the Matomo origin.
- Proxying `matomo.js`/`matomo.php` through the main domain to get past ad blockers. A possible follow-up, since some visitors will be undercounted.
- Ecommerce tracking or revenue values: affiliate revenue is only known in the Booking.com/CJ and GYG partner dashboards.

---

## Verification

- Dev (`matomoUrl` empty): no requests to any Matomo host; network tab clean.
- With a real `matomoUrl`/`matomoSiteId`:
  - **No cookies:** after browsing several pages, DevTools → Application → Cookies shows no `_pk_*` or `mtm_*` cookies.
  - **Page views:** each in-app route change (no reload) appears once in Matomo's Visits Log, with the correct title. Destination pages show the destination name, not a placeholder. The first page load isn't counted twice.
  - **Events:** each event in §2 appears under Behaviour → Events with the right category, action and name.
  - **Opt-out:** after toggling on the Privacy Policy page, no further requests reach `matomo.php`, and the setting survives a reload. Toggling back resumes tracking from the next load.
  - **Do Not Track:** with the browser's DNT setting on, no tracking requests are sent.
  - **SSR:** server-rendered HTML contains no tracker request, and `init()` doesn't run on the server.

---

## References

- @frontend/src/app/app.ts
- @frontend/src/app/shared/services/seo.ts (`titleSet$` hook)
- @frontend/src/app/shell/footer-nav/footer-nav.ts (NavigationEnd pattern)
- @frontend/src/app/features/hotels/hotel-search/hotel-search.ts
- @frontend/src/app/features/destinations/destination-detail/destination-detail.ts
- @frontend/src/app/features/experiences/gyg-activities/gyg-activities.html
- @frontend/src/app/shared/services/billing.ts
- @frontend/src/app/features/auth/profile/profile.ts
- @frontend/src/app/features/trip-planner/step5-save/step5-save.ts
- @frontend/src/app/features/legal/privacy-policy/privacy-policy.html
- @frontend/src/environments/environment.ts
- @frontend/src/environments/environment.prod.ts
- @context/features/mys-bot-traffic-resilience-spec.md
- @frontend/src/app/shared/services/matomo.ts (new)
