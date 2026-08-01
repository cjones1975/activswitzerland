# SEO — Phase 2: Path-Based Locale Routing + hreflang

## Why

Phase 1 (`seo-ssr-foundation-spec.md`) made pages crawlable, but every URL still shares one
language — `ngx-translate` swaps UI strings client-side under a single shared route, so Google
can only ever index **one language version** of `/destinations/xyz`, whichever happens to render.
For a Swiss audience where German/French/Italian searches are a meaningful share of traffic, this
is where most of the remaining visibility gain sits — more than anything else left in the wider
SEO plan. Real `hreflang` requires each language to be a distinct, independently crawlable URL;
it cannot be retrofitted onto a single shared URL.

Sequenced directly after Phase 1 per that spec's own reasoning, not because it's low priority.

## Current state (verified against the repo, not assumed)

- i18n today: `ngx-translate` + `TranslateService`, with `I18nLoader`
  (`shared/services/i18n-loader.ts`, added in Phase 1) — browser fetches `/i18n/{lang}.json`,
  server uses statically-bundled JSON. **These translation files need no changes for this
  phase** — they're flat key→string maps keyed by language code, entirely decoupled from
  routing; only what *drives* the `lang` value passed to `.use()` changes.
- `LangService` (`shared/services/lang.ts`): `.current` reads from `localStorage` (browser) /
  returns a hardcoded `'en'` default (server, added in Phase 1's SSR guard). `.set(lang)` writes
  `localStorage` and calls `translate.use(lang)`. Purely client-side preference, zero URL
  involvement.
- `MenuNav.changeLanguage(lang)` (`shell/menu-nav/menu-nav.ts:40`) just calls
  `this.langSvc.set(lang)` — an instant in-place string swap, no navigation at all today.
- No Angular built-in i18n (`angular.json` has no `"i18n"` block) — purely `ngx-translate`, no
  competing mechanism to reconcile.
- Every component that reacts to language changes already does so via
  `this.translate.onLangChange.pipe(startWith({ lang: this.langSvc.current }), ...)` (Home,
  `DestinationVerticalList`, `DestinationsLayout`, `ExploreTrips`, `SearchPage` — all wired in
  Phase 1 for `SeoService`). Calling `translate.use(lang)` fires the same event these already
  listen to — **this pattern needs no changes**; only `LangService.current`'s source changes.
- Route table (`app.routes.ts`): `''`, `destinations`, `destinations/:id`, `trip-planner`,
  `trip-planner/:id`, `explore-trips`, `search`, `auth/**` — see Phase 1 spec for the full
  render-mode split (`Prerender`/`Server`/`Client`) each currently has.
- Internal navigation surface, grepped exhaustively (not estimated): 9 `routerLink` uses
  (`footer-nav.html` ×4, `menu-nav.html` ×4, `header-nav.html` ×1, plus one back-link in
  `destination-vertical-list.html`) and 15 imperative `router.navigate([...])` calls across
  `auth.ts`, `footer-nav.ts`, `menu-nav.ts`, `trip-planner-layout.ts`, `step5-save.ts`,
  `drawer-host.ts`, `home.ts`, `destination-vertical-list.ts`, `destination-search-results.ts`,
  `profile.ts`. A bounded, auditable ~24 call sites, not a sprawling sweep — but every one needs
  to carry the current locale forward, or switching language and clicking anything silently
  drops the visitor back into a different language.
- `destinations/:id`'s slug (`Destination.identifier`) is a bare UUID (confirmed against the
  model and every sample id used throughout Phase 1's testing, e.g.
  `fff733d5-7f3a-445f-908d-bc6436963855`) — not a localized string. Assumption carried into this
  spec: the same id resolves correctly regardless of locale prefix, needs live confirmation
  during implementation, not proven from static analysis alone.

## Confirmed decisions

- **All four locales get an explicit prefix, including English (`/en/`, `/de/`, `/fr/`,
  `/it/`)** — not "English unprefixed, others prefixed." An asymmetric scheme avoids one redirect
  hop for already-indexed English URLs, but Phase 1 only just went live (the first external
  crawl check happened this session) — essentially nothing is indexed yet, so that continuity
  benefit is worth ~nothing right now and will only get more expensive to unwind later. The
  symmetric scheme is simpler to reason about, avoids Angular route-matcher tricks for an
  "optional" prefix, and every locale gets identical treatment for hreflang/hierarchy purposes.
  Bare `/` (and bare `/destinations`, etc.) redirects to `/en/...` — a real HTTP redirect during
  SSR, not a client-side-only one (`@angular/ssr` propagates a router redirect as a genuine
  response during server rendering, not a rendered page — needs confirming live, not just
  assumed, during implementation).
- **Redirect target for bare `/` is unconditionally `/en/`** for this phase — no `Accept-Language`
  sniffing or stored-preference redirect logic. Which language a first-time visitor with no set
  preference lands on is a UX nicety, not an indexability requirement (crawlers discover and
  index all four locale URLs regardless of the default), so it's not worth the edge cases of
  header-sniffing right now. Can be revisited later without affecting indexing.
- **Navigation goes through a small centralized helper, not Angular's relative-routing
  resolution.** Angular can implicitly preserve a route prefix via relative `routerLink`s
  resolved against the current `ActivatedRoute`, but several of the ~24 call sites above
  (`footer-nav`, `menu-nav`, `drawer-host`) aren't themselves routed components — they're shell
  chrome or a service, so their own `ActivatedRoute` context doesn't cleanly reflect route depth.
  Relying on relative-link resolution there would be fragile and hard to verify by inspection.
  Instead: a new method (on `LangService` or a small dedicated service) takes route commands and
  prepends the current locale segment; every one of the ~24 call sites is updated to use it
  explicitly. More files touched, but each change is a one-line, auditable diff instead of
  depending on router-internals behavior that's hard to confirm by reading code alone.
- **`MenuNav.changeLanguage(lang)` becomes a real navigation**, not a string swap: computes the
  equivalent path in the target locale (swap the current `:lang` segment) and navigates to it,
  rather than calling `LangService.set()` in place.

## Scope

### Routing restructure
- Every existing route gains a `:lang` parent segment, matched against exactly
  `en|de|fr|it` (a route `matcher` function or an equivalent guard — not an unconstrained
  string param, so a garbage locale segment doesn't silently 404 deep in the tree instead of
  redirecting/erroring cleanly at the top).
- A guard/resolver on the `:lang` route calls `translate.use(lang)` on activation — this alone
  keeps every existing `onLangChange`-driven component working unchanged (see Current state).
- `LangService.current` changes from a `localStorage` read to reading the active route's
  resolved `:lang` param (via `Router`/injected route snapshot, not `ActivatedRoute` alone,
  since `LangService` is a root-provided singleton, not scoped to a specific routed component).
- Bare (unprefixed) paths redirect to their `/en/...` equivalent.

### `app.routes.server.ts` (render mode)
- Home stays prerendered, but now once per locale (`getPrerenderParams` enumerating the 4 fixed
  locale codes — a small, fixed list, nothing like Phase 1's 945-destination rate-limit problem).
- `destinations`, `destinations/:id`, `explore-trips`, `search` stay `RenderMode.Server` —
  adding a `:lang` segment ahead of them doesn't change their render mode, just adds a param
  Angular already resolves per request.
- `trip-planner/**`, `auth/**` stay `RenderMode.Client`, now matched under every locale prefix.

### Navigation helper
- New method prepending the current/target locale to a route-commands array, used at all ~24
  call sites enumerated in Current state (`routerLink`s converted to a bound/computed array or a
  small directive; imperative `router.navigate()` calls wrapped).
- `MenuNav.changeLanguage()` rebuilt to navigate to the locale-swapped equivalent of the current
  URL (see Confirmed decisions).

### hreflang
- `SeoService.set()` (Phase 1) gains alternate-language `<link rel="alternate" hreflang="...">`
  tags — one per locale pointing at that same logical page in each language, plus one
  `hreflang="x-default"` (pointing at the `/en/...` version, matching the default-redirect
  target). Needs the current path with its locale prefix stripped, to reconstruct the sibling
  URLs — same underlying "know the current path, know the locale list" logic as the navigation
  helper above; check whether it's worth sharing rather than duplicating.
- Canonical/`og:url` (already fixed to build from a fixed `SITE_URL` constant + `Router.url` post
  Phase 1's `localhost`-canonical bug) needs no structural change beyond `Router.url` now
  naturally including the `:lang` segment.

### `robots.txt` + `sitemap.xml`
- `scripts/generate-sitemap.mjs` needs every static/destination URL emitted once per locale
  (4x the current entry count) rather than once. Sitemap-level hreflang annotation
  (`<xhtml:link rel="alternate" hreflang="..." href="...">` per `<url>` entry, the standard
  companion to page-level hreflang tags) — decide during implementation whether to add this on
  top of page-level tags or rely on page-level alone; both are valid, doing both is redundant but
  not harmful.
- `robots.txt` itself needs no structural change (the `Disallow: /trip-planner` / `Disallow:
  /auth` rules apply the same way under every locale prefix, since they match on path substring
  regardless of what's ahead of it) — verify live rather than assume, since a locale prefix
  changes where in the path those substrings appear.

## Out of scope (this phase)

- `Accept-Language`-based smart redirect for bare `/` (see Confirmed decisions) — deferred, not
  required for indexability.
- JSON-LD structured data (Phase 3).
- Search Console/Bing Webmaster verification, sitemap submission, IndexNow (Phase 4).
- Translating any content that isn't already covered by the existing `ngx-translate` JSON files
  (e.g., MySwitzerland destination/attraction data is already fetched with a `language` param
  per Phase 1 — no new translation work implied by this phase, only routing/URL structure).
- Any hike/bike standalone detail route (still doesn't exist — see Phase 1 spec's Current state).

## Open items to confirm live during implementation (not guessable from static analysis)

- Whether `@angular/ssr` actually propagates a route-level redirect (bare `/` → `/en/`) as a
  real HTTP redirect response during SSR, or renders the redirect target's content directly at
  the original URL — materially affects whether the bare-path redirect is a genuine 30x or a
  same-URL render, which matters for canonical/duplicate-content correctness.
- Whether `Destination.identifier` genuinely resolves identically regardless of the `language`
  query param sent alongside it (see Current state's assumption).
- Exact behavior of `robots.txt`'s existing `Disallow` rules once real paths gain a `/de/`-style
  prefix ahead of `/trip-planner`/`/auth`.

## References

- @frontend/src/app/app.routes.ts
- @frontend/src/app/app.routes.server.ts
- @frontend/src/app/app.config.ts
- @frontend/src/app/shared/services/lang.ts
- @frontend/src/app/shared/services/i18n-loader.ts
- @frontend/src/app/shared/services/seo.ts
- @frontend/src/app/shell/menu-nav/menu-nav.ts
- @frontend/src/app/shell/menu-nav/menu-nav.html
- @frontend/src/app/shell/footer-nav/footer-nav.ts
- @frontend/src/app/shell/footer-nav/footer-nav.html
- @frontend/src/app/shared/drawer-host/drawer-host.ts
- @frontend/src/app/models/destination.ts
- @frontend/scripts/generate-sitemap.mjs
- @frontend/nginx.conf
- @context/features/seo-ssr-foundation-spec.md
