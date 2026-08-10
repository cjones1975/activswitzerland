# SEO — Phase 3: Structured Data, `html lang` Fix, Sitemap Metadata

## Why

Phases 1 (`seo-ssr-foundation-spec.md`) and 2 (`seo-locale-routing-hreflang-spec.md`) made
pages crawlable, per-locale, with correct canonical/hreflang. A follow-up audit of the live
setup this session found three remaining gaps, none blocked on each other or on further routing
work, bundled here as one branch:

1. **No structured data anywhere.** Zero JSON-LD in the app — no `WebSite` schema (which is
   what unlocks Google's sitelinks searchbox), no `Place`/`TouristAttraction` markup on
   destination-detail pages, which are the one content type that's fully indexable today.
2. **`<html lang>` is wrong on every non-English page.** Hardcoded to `"en"` in
   `index.html`, never updated per-locale despite `canonical`/`hreflang`/title/description all
   being correctly localized. Verified in actual build output: `/de/index.html` and
   `/fr/index.html` both render `<html lang="en">`. This is both an accessibility bug (screen
   readers mispronounce German/French/Italian content as English) and a weak-but-real SEO
   signal bug.
3. **Sitemap entries carry no `<lastmod>`/`<priority>`.** Only `<loc>` per URL today — no signal
   to crawlers about which pages matter most or when they last changed.

Deliberately **not** included: standalone attraction/hike/bike routes, or JSON-LD for them.
Discussed this session — see Confirmed decisions.

## Current state (verified against the repo, not assumed)

- `SeoService` (`frontend/src/app/shared/services/seo.ts`) is the only place that touches
  `<head>` today: title, description, robots, OG/Twitter tags, canonical, hreflang — all via
  Angular's `Meta`/`Title` services and direct `DOCUMENT` manipulation for the `<link>` tags. No
  JSON-LD `<script>` handling exists anywhere.
- `localeLangResolver` (`frontend/src/app/core/guards/locale.ts:25-30`) runs on every `:lang`
  route activation, both server (prerender/SSR) and client, and already calls
  `translate.use(lang)`. It does not touch `document.documentElement.lang` — nothing in the repo
  does (confirmed by grep for `documentElement`, `.lang =`, `setAttribute('lang'` across
  `frontend/src`).
- `frontend/src/index.html:2` hardcodes `<html lang="en">` as the only source of the attribute in
  both prerendered and SSR output, since nothing overrides it at render time.
- Destination-detail (`frontend/src/app/shell/destinations-layout/destinations-layout.ts:275-288`)
  already loads the full `Destination` object and calls `SeoService.set()` with `dest.name`,
  truncated `dest.description || dest.abstract`, and `dest.photo` — no new data fetch needed for
  a `Place`/`TouristAttraction` block, same data already in hand.
- The `Destination` model (`frontend/src/app/models/destination.ts:9-21`) already carries
  `'@context'` and `'@type'` string fields and a `geo: { '@type', latitude, longitude }` object,
  passed through unchanged from the upstream MySwitzerland API response — these look schema.org
  shaped at the field-name level, but their actual values haven't been inspected live (no fixture
  data in the repo). Worth checking before assuming a `@type` needs to be hardcoded — see Open
  items.
- `frontend/src/app/features/search/search-page/search-page.ts:47` confirms the real search URL
  shape: `/{lang}/search?q={query}` (query param name `q`) — the shape a `WebSite` `SearchAction`
  target needs.
- `frontend/scripts/generate-sitemap.mjs` (postbuild step) generates `sitemap.xml`/`robots.txt`
  from a paginated destination-list fetch; `buildSitemap()` (lines 53-61) emits only `<loc>` per
  `<url>`, no `<lastmod>`/`<changefreq>`/`<priority>`.
- No `lastUpdate`/`dateModified`/similar timestamp field exists anywhere in the backend's
  destination data path (grepped `backend/src` — no match) — the MySwitzerland API doesn't appear
  to expose a per-destination modification date, so a real `<lastmod>` isn't derivable for
  destination-detail URLs specifically. See Open items.

## Confirmed decisions

- **Attractions/hikes/bikes stay drawer-only — no standalone crawlable routes, no JSON-LD for
  them, in this spec or otherwise right now.** This was floated as a possible addition this
  session and explicitly declined: hike/bike/attraction detail was deliberately scoped as
  drawer-only content inside destination-detail as part of Phase 0 of the trip-planner rebuild
  (documented in `seo-ssr-foundation-spec.md`'s Current state), and that rebuild is still
  mid-flight. Making them independently routable is a routing/product change in its own right
  that needs to be reconciled with wherever the trip-planner rebuild currently stands — out of
  scope for a pure SEO-hardening branch.
- **JSON-LD scope is `WebSite` (sitewide) + `Place`/`TouristAttraction` (destination-detail
  only).** No `BreadcrumbList`, no `LodgingBusiness`/hotel schema (hotels are a stub feature, not
  live content), nothing for attractions/hikes/bikes (see above). Destinations are the only
  content type that's a real standalone indexable page today, so that's where the marginal value
  of per-page structured data actually is.
- **Sitemap `<lastmod>` is omitted entirely for destination-detail URLs**, kept only on the two
  static entries (home, `/destinations` list) where a build timestamp is genuinely meaningful.
  No per-destination modification date exists anywhere in the data path (see Current state), and
  an inaccurate/always-fresh `<lastmod>` is worse than none per Google's own guidance — it trains
  crawlers to ignore the field site-wide.

## Scope

### `html lang` fix
- `localeLangResolver` (`core/guards/locale.ts`) additionally sets
  `inject(DOCUMENT).documentElement.lang = lang` alongside the existing `translate.use(lang)`
  call. Runs on every route activation on both server and client, so it lands in prerendered and
  SSR output the same way `canonical`/hreflang already do — no separate server-only code path
  needed.
- `frontend/src/index.html`'s static `lang="en"` stays as the pre-hydration fallback for the
  bare shell (unavoidable — the resolver hasn't run yet at that point), consistent with how the
  static `<title>`/description in that file already work as fallbacks Phase 1 established.

### `WebSite` JSON-LD (sitewide)
- One `<script type="application/ld+json">` block: `@type: "WebSite"`, `name`, `url` (site
  root), and a `SearchAction` (`target` built from the confirmed `/​{lang}/search?q={query}`
  shape, `query-input: "required name=search_term_string"`).
- Injected once, not per-route — natural home is `App` (`frontend/src/app/app.ts`), the root
  component every route renders under, rather than threading it through `SeoService.set()`'s
  per-route call sites.

### `Place`/`TouristAttraction` JSON-LD (destination-detail)
- Added alongside the existing `SeoService.set()` call in `destinations-layout.ts:281-285`, built
  from the same `Destination` object already loaded: `name`, `description`, `image: dest.photo`,
  `geo: { '@type': 'GeoCoordinates', latitude, longitude }` from `dest.geo`, `url` (canonical
  page URL, matching what `SeoService` already computes).
- Extends `SeoService` with a method that manages a JSON-LD `<script>` tag the same way
  `setCanonical`/`setHreflang` manage `<link>` tags (create-if-missing, update in place, so it's
  correctly cleared/replaced on route change) — kept in the one service that already owns
  per-page `<head>` lifecycle, rather than a new sibling service.
- If live inspection (see Open items) shows the upstream `dest['@type']`/`dest['@context']`
  values are already schema.org-valid, prefer reusing them over hardcoding `'Place'` — but don't
  assume; hardcode `'Place'` (with `additionalType: 'TouristAttraction'` or similar) as the
  fallback if they turn out to be MySwitzerland's own internal type vocabulary instead.

### Sitemap `<lastmod>` / `<priority>`
- `<priority>` (static, tiered): home `1.0`, `/destinations` list `0.8`, per-destination detail
  `0.6`. Cheap to add, no data dependency.
- `<lastmod>` on the two static entries only (home, `/destinations` list), set to the sitemap
  build run's timestamp. Omitted entirely for destination-detail URLs — see Confirmed decisions.

## Out of scope (this phase)

- Standalone attraction/hike/bike routes and any structured data for them (see Confirmed
  decisions).
- `BreadcrumbList`, `LodgingBusiness`, or any other schema type beyond `WebSite` and
  `Place`/`TouristAttraction`.
- Search Console/Bing Webmaster verification, sitemap submission, IndexNow — this was always
  Phase 4 of the original 4-phase plan, untouched by this branch.
- Sitemap-level `xhtml:link hreflang` annotations (flagged as an open "decide later" item back in
  the Phase 2 spec, still undecided, still not part of this branch).
- The `SITE_URL` hardcoding in `seo.ts`/`generate-sitemap.mjs` — that's a deliberate decision
  from Phase 1 (proxy-header bugs), not a gap, and stays as-is.

## Open items to confirm live during implementation (not guessable from static analysis)

- What `dest['@type']`/`dest['@context']` actually contain at runtime — real schema.org values
  passed through from MySwitzerland, or MySwitzerland's own internal vocabulary that only
  coincidentally uses schema.org-style field names. Determines whether the `Place`/
  `TouristAttraction` JSON-LD can reuse upstream values or must hardcode its own `@type`.
- Whether Google's sitelinks-searchbox `SearchAction` should target the default-locale
  (`/en/search`) URL only, or needs to be locale-aware somehow — `WebSite` schema is normally one
  sitewide entity, not one per locale, so leaning toward a single `/en/search?q=...` target, but
  worth confirming this doesn't look wrong for DE/FR/IT visitors before committing.

## References

- @frontend/src/app/shared/services/seo.ts
- @frontend/src/app/core/guards/locale.ts
- @frontend/src/app/app.ts
- @frontend/src/app/shell/destinations-layout/destinations-layout.ts
- @frontend/src/app/models/destination.ts
- @frontend/src/app/features/search/search-page/search-page.ts
- @frontend/src/index.html
- @frontend/scripts/generate-sitemap.mjs
- @context/features/seo-ssr-foundation-spec.md
- @context/features/seo-locale-routing-hreflang-spec.md
