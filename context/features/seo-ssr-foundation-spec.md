# SEO — Phase 1: SSR Foundation, Per-Page Metadata, Sitemap/Robots

## Why

A crawler fetching the homepage today gets an empty Angular shell: no rendered content, one
shared `<title>` ("ActivSwitzerland") for every route, no meta description, no `robots.txt` or
`sitemap.xml`. Googlebot renders JS but on a deferred second pass that doesn't reliably cover
large route sets; Bing, DuckDuckGo, and AI crawlers largely don't render JS at all. Everything
else in the wider SEO plan (hreflang, structured data, Search Console) is blocked on this being
fixed first, since none of it matters if pages aren't indexable at all.

This is Phase 1 of a 4-phase plan:
- **Phase 1 (this spec):** SSR/prerendering, per-page metadata, sitemap.xml/robots.txt.
- **Phase 2 (next, no gap):** path-based locale routing (`/fr/`, `/de/`, `/it/`) + hreflang.
  Deferred out of this phase because it's a routing restructure in its own right (today's
  `ngx-translate` setup swaps strings client-side under one shared URL — see Out of scope
  below) — not because it's low priority. For a Swiss audience the DE/FR/IT split is where
  most of the actual search-visibility gain sits; Phase 1 alone only makes one language's
  content crawlable.
- **Phase 3:** JSON-LD structured data (`TouristAttraction`/`Place`, `LodgingBusiness`,
  `BreadcrumbList`).
- **Phase 4:** Search Console/Bing Webmaster verification, sitemap submission, IndexNow,
  content-depth work on flagship routes.

## Current state (verified against the repo, not assumed)

- Frontend is a pure client-side Angular 21 SPA — no `@angular/ssr` installed, no server
  build target in `angular.json` (only `browser`/`serve`/`test` architects).
- Served by `nginx:1.27-alpine` (`infra/docker/frontend/Dockerfile`) copying the built
  `dist/frontend/browser` output straight into `/usr/share/nginx/html`. `frontend/nginx.conf`
  proxies `/api/` to the backend and catch-alls everything else to `index.html`
  (`try_files $uri $uri/ /index.html`). The Express backend (`backend/src/server.js`) is
  API-only — it never serves frontend files, so the earlier "make sure Express serves
  robots.txt/sitemap.xml before the SPA catch-all" concern doesn't apply to this stack; static
  files just need to exist under `frontend/public/` and nginx's `try_files` will pick them up
  before the catch-all fires.
- No `robots.txt` or `sitemap.xml` exist anywhere in `frontend/public/` today.
- No `Title`/`Meta` service usage anywhere in the app — no per-route resolvers setting title
  or description. Every route shares `index.html`'s static `<title>`.
- Route table (`frontend/src/app/app.routes.ts`): `''` (Home), `destinations`
  (`DestinationVerticalList`), `destinations/:id` (`DestinationsLayout`), `trip-planner` /
  `trip-planner/:id` (`TripPlannerLayout`), `explore-trips`, `search`, `auth/profile`
  (guarded).
- `destinations/:id` data comes from `DestinationsService.getDestination(id, language)` →
  backend `GET /api/v1/myswitzerland/destinations/:id` (Redis-cached, 24h TTL, proxy over the
  MySwitzerland API). The list (`GET /api/v1/myswitzerland/destinations`) enumerates every
  destination id — used by `scripts/generate-sitemap.mjs` to build `sitemap.xml`.
- Hike/bike route detail (`ch.astra.wanderland`/`veloland`, `backend/src/routes/hikingRoutes.js`
  / `bikeRoutes.js`) is surfaced today as **drawers inside destination-detail**, not as
  standalone routed pages (per Phase 0 of the trip-planner rebuild). There is currently no
  dedicated hike/bike detail URL to prerender — if/when one exists, it slots into this same
  prerender-from-dataset pattern.

## Confirmed decisions

- **Trip Planner (`trip-planner`, `trip-planner/:id`): noindex, client-render only, no
  SSR/prerendering.** These are a user's personal saved itineraries, not canonical content,
  and the feature is still mid-rebuild (Phase 4 "Save Trip" not started yet — see
  `trip-planner-rebuild-spec.md`). Revisit only if a future "share this trip publicly" feature
  is ever built.
- **`auth/profile`: same treatment (noindex, client-render only)** — authenticated, personal
  content, same reasoning as Trip Planner. Not separately asked about, but it's the same
  category of page and there's no case for treating it differently.
- **Locale routing/hreflang is out of scope for this phase**, sequenced as the very next branch
  afterward (see Why).

## Scope

### Prerender (SSG) at build time
- `''` (Home) only — a single static page with a small, fixed fetch volume (a few category
  preview lists for the horizontal destination carousels).

### SSR (server-rendered per request, not prerendered)
- `destinations`, `destinations/:id`, `explore-trips`, `search`.
- **Destinations were originally scoped as prerendered** (data "changes rarely" — see Current
  state), but that was reversed after implementation surfaced two real problems: (1)
  prerendering all ~945 destinations fires that many data fetches at build time, which
  reliably hit the upstream MySwitzerland API's rate limit (observed: ~85-90% of pages falling
  back to the generic shell title in a from-scratch build); (2) a prerendered page is a file
  baked once and served unchanged until the next full rebuild+deploy (no scheduled rebuild
  exists in this repo) — if MySwitzerland renames, updates, or delists a destination, a stale
  or orphaned static page keeps being served (and keeps being listed in the sitemap)
  indefinitely. SSR per request instead: freshness is bounded by the backend's 24h Redis
  cache rather than "until someone redeploys," a failed fetch is just that one request (the
  next visit gets a fresh attempt) rather than permanently baked into a static file, and real
  traffic to ~945 long-tail pages is naturally spread out rather than arriving as a
  synchronized build-time burst — so the rate-limit problem doesn't recur under normal usage.
  `explore-trips`/`search` were SSR from the start — dynamic/interactive content with no
  fixed param set to enumerate, so prerendering never applied to them; SSR still gets them a
  real title/description/canonical on first paint instead of an empty shell.

### CSR-only, noindex (no SSR/prerender)
- `trip-planner`, `trip-planner/:id`, `auth/profile` (see Confirmed decisions).
- Implement noindex via a `<meta name="robots" content="noindex">` set through the `Meta`
  service on these routes (see Per-page metadata below), plus a `Disallow:` entry in
  `robots.txt` as a backup for crawl budget.

### Per-page metadata
- Add a small shared SEO helper (new, e.g. `shared/services/seo.ts`) wrapping Angular's
  `Title`/`Meta` services with one call per route: title, ≤160-char description, canonical
  `<link>`, Open Graph (`og:title`, `og:description`, `og:image`, `og:url`) and Twitter card
  tags.
- Wire it per route from within each component (called once real data is available, or
  immediately for static copy) via the shared `SeoService` (`shared/services/seo.ts`):
  - Home: static copy (`seo.home.*` i18n keys).
  - `destinations` (list): copy per category (`config().title`/`subtitle`).
  - `destinations/:id`: built from the fetched `Destination` (name, description/abstract
    stripped of markup and truncated, photo) — no new data fetch, reuse what
    `DestinationsLayout` already loads.
  - `explore-trips`, `search`: static copy (`seo.exploreTrips.*`/`seo.search.*` i18n keys).
  - `trip-planner*`, `auth/profile`: `noindex` robots meta, no OG/canonical needed.

### `robots.txt` + `sitemap.xml`
- Both generated at build time by `scripts/generate-sitemap.mjs` (postbuild step, see
  `package.json`'s `build` script) from a `SITE_URL` env var and the same destination-list
  fetch pattern, written into `dist/frontend/browser/` — not hand-maintained, never ships
  with a placeholder domain.
- `robots.txt`: allow all, `Disallow: /trip-planner`, `Disallow: /auth`, references
  `Sitemap: ${SITE_URL}/sitemap.xml`.
- `sitemap.xml`: home + `destinations` + one `<url>` per destination id (paginated fetch
  against the backend's destination list, independent of rendering — see Scope above for why
  this no longer drives prerendering).
- Verified reachable post-deploy: nginx's `try_files` checks `$uri` before falling through,
  so these real static files under `browser/` are served correctly ahead of any SSR proxying.

### Deployment changes (implemented)
`@angular/ssr` needs a Node process running in production — split into two images from one
multi-stage `infra/docker/frontend/Dockerfile` (shared `builder` stage, two `--target`s):
- **`frontend` target** (nginx): serves static assets, `robots.txt`/`sitemap.xml`, and Home's
  single prerendered page directly; proxies everything else (`@ssr` named location in
  `frontend/nginx.conf`) to the `frontend-ssr` service for live rendering, alongside the
  existing `/api/` → backend proxy.
- **`frontend-ssr` target** (Node): runs `dist/frontend/server/server.mjs`
  (`@angular/ssr`-generated Express server), production-only `npm ci --omit=dev` rather than
  reusing the builder's dev-inclusive `node_modules`.
- `infra/docker-compose.prod.yml`: new `frontend-ssr` service; `frontend` now depends on it.
- **`SSR_API_URL`**: one variable, two different values by context — a **build-time** Docker
  ARG (`infra/docker/frontend/Dockerfile`'s `builder` stage, wired through
  `infra/build-and-push.ps1`) reachable from wherever the image is built, used by Home's
  prerender fetch and `generate-sitemap.mjs`; and a **runtime** value
  (`infra/docker-compose.prod.yml`'s `frontend-ssr` service `environment:`, set to
  `http://backend:3000`, the compose service name) read by `ssrBaseUrlInterceptor`
  (`core/interceptors/ssr-base-url.interceptor.ts`) for every live-rendered request
  (destinations, destinations/:id, explore-trips, search). Same env var name, read at two
  different times by the same interceptor code — not two separate mechanisms.
- **`NG_ALLOWED_HOSTS`** (required, `infra/docker-compose.prod.yml`'s `frontend-ssr`
  `environment:`, substituted from `infra/.env.prod`): `@angular/ssr` rejects any live request
  whose `Host` header isn't in this comma-separated allowlist as an SSRF guard, and — found
  during verification, not documented anywhere in Angular's scaffold — the default from
  `ng add @angular/ssr` (`angular.json`'s `security.allowedHosts: []`) allows nothing, so
  every real request would otherwise silently fall back to CSR (empty shell, no SEO content,
  still a 200 response — no error surfaces anywhere) instead of erroring loudly. Read from
  `NG_ALLOWED_HOSTS` at runtime (`@angular/ssr/node`'s `getAllowedHostsFromEnv`), not baked
  into the image at build time, so it doesn't need to be known when the image is built. Must
  be set to the real public domain(s) before deploy — see `infra/.env.prod.example`.

## Out of scope (this phase)

- Path-based locale routing / hreflang (Phase 2, immediately next).
- JSON-LD structured data (Phase 3).
- Search Console/Bing Webmaster verification, sitemap submission, IndexNow (Phase 4).
- Thin-content differentiation / flagship-route content depth — a content workstream, not
  blocked by this phase, but only worth investing in once pages are actually crawlable.
- Any hike/bike standalone detail route (none exists today — see Current state).

## References

- @frontend/src/app/app.routes.ts
- @frontend/src/app/app.config.ts
- @frontend/src/app/features/destinations/destination-vertical-list/destination-vertical-list.ts
- @frontend/src/app/shell/destinations-layout/destinations-layout.ts
- @frontend/src/app/shared/services/destinations.ts
- @frontend/src/app/shared/services/seo.ts
- @frontend/src/app/core/interceptors/ssr-base-url.interceptor.ts
- @frontend/src/app/app.routes.server.ts
- @frontend/scripts/generate-sitemap.mjs
- @backend/src/middleware/cache.js
- @backend/src/routes/myswitzerland.js
- @backend/src/controllers/myswitzerland.js
- @frontend/nginx.conf
- @infra/docker/frontend/Dockerfile
- @infra/docker-compose.prod.yml
