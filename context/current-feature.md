# Current Feature

## Feature

## Status

## Goals

## Phase breakdown

## Notes

## History

<!-- Keep this updated. Earliest to latest -->

### 2026-08-11 — Toast Redesign + Start-Over Modal Replaced with Action Toast

- No feature branch/spec — user-directed design/UX changes made directly, following on from an
  earlier full audit of every toast call site in the app (`core/services/toast.ts` wrapper,
  `app.html`'s global `<p-toast>`, and every `.success()`/`.info()`/`.warn()`/`.error()` call
  across `auth.ts`, `destinations-layout.ts`, `step4-summary.ts`, `step5-save.ts`, `profile.ts`)
- **Toast visual redesign**: user shared three mockup screenshots (info/error/warn) and asked to
  match them, including colors, with explicit icon classes for success/warn/error
  (`fa-thumbs-up`/`fa-circle-exclamation`/`fa-circle-xmark`). `styles.css`'s toast section
  rewritten from solid dark backgrounds (navy/red, plus a warn variant that was wrongly styled
  blue) to pale tinted backgrounds + matching colored border + colored bold heading + neutral
  gray body text, one palette per severity (success green, warn amber, error red, info blue —
  info icon `fa-circle-info` chosen by inference, not specified in the mockups, flagged to the
  user as a guess). `app.html`'s icon template extended from a two-way (success/else) branch to
  all four severities
- **Real bug found and fixed as a side effect**: CSS was keyed off a manually-passed `styleClass`
  string (`'toast-success'`/`'toast-error'`/etc.) that every call site has to remember to pass
  correctly — `step5-save.ts`'s *success* toast was passing `'toast-error'` (copy-paste mistake),
  so a successful trip save rendered with error styling. Fixed at the root by rekeying every CSS
  rule off PrimeNG's own automatic `.p-toast-message-{severity}` class instead (derived directly
  from the `severity` argument, can't drift from it) — the stray manually-passed classes are now
  harmless no-ops at every call site, none needed touching
- **Start-over confirmation**: user asked to replace the trip planner's "Start over" link
  confirmation — previously a `p-confirmDialog` modal (`ConfirmationService`) — with a toast
  that has action buttons, in the light-blue (info) palette just built. Investigated PrimeNG's
  `MessageService`/`Toast` internals first (`canAdd()` requires `this.key === message.key`,
  `clear(key)` only clears a matching-key instance) to confirm a second, `key`-scoped `<p-toast>`
  is the correct mechanism for an isolated action toast that can be dismissed without touching
  any other toast in the app. `start-over-link.ts` now calls `MessageService.add()` directly
  (bypassing the simple `Toast` wrapper, which has no support for `sticky`/`key`/`data`) with
  `severity: 'info'`, `sticky: true`, and `data: { onAccept, onReject }` callbacks; confirmed via
  code search that `trip-planner-wizard`'s `<p-confirmDialog>`/`ConfirmationService` provider
  were used *only* for this one confirmation (untouched: `profile.ts`'s separate
  `ConfirmationService`/`<p-confirmDialog>`, a different, unrelated confirmation)
  - New `<p-toast [key]="startOverKey">` + message template added to `trip-planner-wizard.html`
    (replacing the old `<p-confirmDialog />`), with Cancel/Start-Over buttons wired to
    `message.data.onReject()`/`onAccept()`. Old `ConfirmDialog`/`ConfirmationService`
    imports+provider removed from `trip-planner-wizard.ts`
  - Reused the *exact* old accept-button colors (`#1a6b3c`, hover `#174f2f`) for visual
    continuity, discovered by re-reading the dead `.start-over-accept-btn` CSS being deleted
    rather than guessing a new color — first draft used `var(--navy-900)` which would have been
    an inconsistent navy-base/green-hover mismatch
  - User follow-up correction: initial toast position `top-center` didn't match — changed to
    `position="center"` to match the global app-wide toast's position exactly
- Verified via `tsc --noEmit` (doesn't check templates) **and a full `ng build`** (does, via
  Angular's `strictTemplates`) — confirms `message.data.onAccept()`/`onReject()` and the new
  `pTemplate`/`[key]` bindings all type-check correctly, not just the `.ts` files
- Not yet committed. Also still open from the earlier toast-audit conversation, not acted on:
  `profile.html` has its own second global `<p-toast position="bottom-center" />` in addition to
  `app.html`'s, with no `key` scoping either — any toast fired while on `/auth/profile` likely
  renders twice

### 2026-08-10 — OJP TripRequest: Connections Migration Implemented, UAT Passed

- Branch `feature/ojp-trip-request` created (target of the Specced entry directly below) and the
  spec implemented in full: `backend/src/utils/ojp.js` gained `buildTripRequest()`/
  `parseTripResponse()` plus ISO-8601 duration helpers and a DST-correct Zurich-local→UTC time
  converter (OJP needs a real UTC instant; the UI picks Swiss wall-clock time).
  `backend/src/controllers/transport.js`'s `getConnections`/`getConnectionJourneys` rewritten to
  call OJP via a new `resolveStopRef()` (uses `TripStop.externalId` directly when it's already an
  OJP ref, falls back to a location lookup for a plain name). Frontend: one line in
  `transport.ts`'s `getConnections()` — `from`/`to` now send `externalId ?? name`, matching what
  `getConnectionJourneys()` already did
- Verified before considering it done, not just written: `node --check`/`tsc --noEmit` clean, then
  the *actual* controller functions (not a standalone reimplementation) called live against the
  real API with fake req/res objects — covering ref-based lookup, name-fallback lookup, the
  sections-only `getConnectionJourneys` shape, and `isArrivalTime=true` (previously flagged as
  untested — confirmed working: placing `DepArrTime` under `Destination` genuinely changes the
  result set). Found and fixed a real bug this way: `fast-xml-parser` auto-types purely-numeric
  platform text (`"15"` → JS number `15`) while codes like `"3CD"` stay strings — inconsistent
  with the frontend's `platform?: string`. Fixed with explicit `String()` coercion in
  `platformOf()`, re-verified every platform value came back quoted after the fix
- **User UAT**: first attempt (Rolle → Lugano, 25.08.26 09:30) came back with no routes found —
  turned out to be the running Docker backend container still serving pre-migration code, not a
  real bug (self-diagnosed by the user, matches the exact same class of issue hit during the
  location-search phase). After rebuilding the container, UAT passed
- **Post-UAT cleanup pass, before commit**: found and removed dead config —
  `TRP_ENDPOINT`/`transport.opendata.ch` was no longer read by any code anywhere but still sat in
  `backend/config/.env`, `infra/.env`, `infra/.env.prod`, and the committed
  `infra/.env.prod.example`; removed from all four and re-labeled the now-broader
  `# opentransportdata.swiss (OJP location search)` comment to `(OJP — locations, connections)`.
  Also found the frontend's `TransportService.getConnections()`/`getConnectionJourneys()` were
  still building `via[]`/`via`/`fields[]` query params the new backend never reads at all —
  removed; `tsc --noEmit` re-confirmed clean after. `infra/.env.prod` edited was the local copy —
  flagged to the user that the NAS-hosted real file (if a separate deploy artifact) still needs
  the same edit
- Not yet committed at time of writing this entry

### 2026-08-10 — OJP TripRequest: Connections Migration Specced

- User raised reliability concerns about `transport.opendata.ch` (no published rate limit/SLA,
  just "constrained by timetable.search.ch's rate limit") for the rail trip planner's connection
  search, and asked whether opentransportdata.swiss's GTFS-RT could replace it instead, worried
  about a 5 calls/minute cap
- Investigated both APIs directly (fetched official docs) before answering: **GTFS-RT is the
  wrong tool** — it's a real-time delay/alert overlay on a static GTFS schedule, not a
  point-to-point journey planner, so it can't do what `/connections` does. The 5/min limit is
  real but specific to GTFS-RT; confirmed via opentransportdata.swiss's own
  [limits-and-costs page](https://opentransportdata.swiss/en/limits-and-costs/) that **OJP 2.0**
  — the same API already used for location search (`ojp-location-search-spec.md`, implemented)
  — gets 50 req/min / 20k/day free, and its `TripRequest` operation does full point-to-point
  search with real-time data merged in
- **Live-tested before committing to a design**, using the existing `TOKEN`/
  `OPENTRANSPORTDATA_ENDPOINT` from `backend/config/.env` (no new key needed): a real
  `OJPTripRequest` Zürich HB → Bern returned 3 full itineraries in ~150ms with genuine live-delay
  data (`TimetabledTime` vs `EstimatedTime` differing per stop), live platform, and per-fare-class
  occupancy — confirmed richer than transport.opendata.ch's data. Then checked whether the XML
  maps onto the existing `TripConnection`/`TripSection` model (`models/trip.ts`) field-by-field
  against the live response — confirmed it maps cleanly with only one small frontend change
  needed (`getConnections()` sending `externalId` instead of `name` for `from`/`to`)
- **Also live-tested OJP's `Via` element** (three request shapes: cookbook-documented,
  `PlaceRef`-wrapped, minimal — against both a terminus and a through-station) since
  `transport.opendata.ch`'s `/connections` supports multiple via stops today — all three
  attempts returned an identical `HTTP 500 "ODMCH OJP Service Unavailable"`. Turned out moot:
  confirmed via code search that `ConnectionLegPicker` (the only caller of `getConnections`/
  `getConnectionJourneys`) always passes exactly `[fromStop, toStop]` — the current trip planner
  has no via-stop UI at all, so the new design drops via support entirely rather than working
  around the 500
- **Found a latent existing bug in passing**: `getConnectionJourneys` already sends
  `stops[0].externalId ?? stops[0].name` to transport.opendata.ch's HAFAS-based `/connections`,
  but since the location-search migration `externalId` is an OJP `sloid` ref, not a HAFAS id —
  likely broken today. Migrating `getConnections`/`getConnectionJourneys` onto OJP fixes this by
  construction; flagged to verify once implemented, not fixed retroactively
- Wrote `context/features/ojp-trip-request-spec.md` (Phase 2 of `ojp-location-search-spec.md`,
  which explicitly deferred rail connection-building). Target branch `feature/ojp-trip-request`,
  not yet created. **Status: proposed, not started** — spec only, no implementation yet
- No temporary test scripts or code changes committed — all live testing done via throwaway
  `.mjs` scripts run from `backend/` (for `node_modules` resolution) and deleted after

### 2026-08-10 — SEO Phase 3: Structured Data, `html lang` Fix, Sitemap Metadata Implemented

- Branch: `feature/seo-structured-data-lang`; spec: `context/features/seo-structured-data-lang-spec.md`.
  Preceded by a full SEO-setup audit (spawned Explore agent) requested by the user, which found
  Phases 1/2 (SSR, per-page metadata, locale routing/hreflang — see 2026-07-31 entries below) were
  already solid, but surfaced three remaining gaps bundled into this one branch
- Two decisions confirmed via `AskUserQuestion` before writing the spec: attractions/hikes/bikes
  stay drawer-only — declined to reopen the Phase-0 trip-planner-rebuild decision to make them
  independently routable, since that's a routing/product change in its own right, not a pure SEO
  fix; JSON-LD scope limited to `WebSite` (sitewide) + destination-detail only (no
  `BreadcrumbList`/`LodgingBusiness`, nothing for attractions/hikes/bikes). A third question (sitemap
  `<lastmod>` for destination pages: omit vs. fake with build timestamp) was left open in the spec
  and the user confirmed "omit" in a follow-up turn, before implementation started
- `core/guards/locale.ts`'s `localeLangResolver` now also sets
  `inject(DOCUMENT).documentElement.lang = lang` alongside the existing `translate.use(lang)` call
  — runs on every route activation, server and client, so it lands in prerendered/SSR output the
  same way canonical/hreflang already do. `index.html`'s static `lang="en"` left as-is (pre-hydration
  fallback, same pattern as its static title/description)
- `shared/services/seo.ts` gained `setWebsite()` (sitewide `WebSite` + `SearchAction` JSON-LD,
  called once from `app.ts`'s constructor, target `/en/search?q={search_term_string}`) and
  `setStructuredData(data | null)` (per-page JSON-LD, `null` clears it — wired into
  `destinations-layout.ts`'s error path so a stale previous destination's structured data doesn't
  linger after a failed load), both backed by a shared `writeJsonLd(id, data)` helper that
  creates-or-updates a `<script type="application/ld+json">` by element id, matching the
  create-if-missing pattern `setCanonical`/`setHreflang` already used for `<link>` tags. New
  `currentUrl()` getter exposes the same canonical-URL computation `set()` already used internally,
  reused for the JSON-LD `url` field
- **Real finding during implementation, not assumed from the spec**: the spec flagged live-checking
  whether `Destination`'s `@type`/`@context` fields (present in the model, passed through unchanged
  from MySwitzerland) were genuine schema.org values or the API's own internal vocabulary. Curled
  the running local backend directly and confirmed real values —
  `"@context":"https://schema.org/"`, `"@type":"TouristDestination"` (a real, more specific
  schema.org type than the `Place`/`TouristAttraction` fallback the spec had planned to hardcode) —
  so `destinations-layout.ts`'s JSON-LD block uses `dest['@context']`/`dest['@type']` directly, with
  `'https://schema.org'`/`'Place'` only as a fallback if either field is ever missing
- `scripts/generate-sitemap.mjs`'s `buildSitemap()` restructured from a flat path list to an array
  of `{ path, priority, lastmod }` entries: home `1.0`/`/destinations` `0.8` (both get a build-date
  `<lastmod>`), destination-detail `0.6` (no `<lastmod>` — per the confirmed decision, no
  per-destination modification date exists anywhere in the data path, and Google's own guidance is
  that a faked/always-fresh value trains crawlers to ignore the field site-wide)
- Verified via `tsc --noEmit` (clean) and a full `npm run build` (production build + postbuild
  sitemap script, `SSR_API_URL` pointed at the local backend) — inspected the actual `dist/`
  output directly rather than trusting the diff: confirmed `<html lang>` correct per locale in
  `en/index.html`/`de/index.html`/`fr/index.html`, `WebSite` JSON-LD present, `sitemap.xml`
  entries carrying `<lastmod>`/`<priority>` exactly as scoped (945 real destination ids). Also
  ran the built SSR server locally (`node dist/frontend/server/server.mjs`) to fetch a live
  `destinations/:id` page and confirm the `TouristDestination` JSON-LD renders correctly with real
  data (name, description, image, geo, canonical url) — hit the `NG_ALLOWED_HOSTS` SSRF guard from
  Phase 1 along the way (needs the bare hostname, not `host:port`, to match) and confirmed a
  passing request end-to-end once set correctly
- Not yet committed at time of writing this entry



- Branch: `misc-fixes3`. No spec — a long running session of independent, user-directed small changes
  and fixes, similar in spirit to `misc-fixes`/`misc-fixes2` before it
- **Trip planner Step 1**: two separate date `<input type="date">` fields replaced with a single
  `p-datepicker` (`selectionMode="range"`, `styleClass="w-full"`). **Real bug found via live testing**:
  the picker's `[ngModel]` was bound to a `computed()` re-derived from the service on every emission,
  so a fresh `Date[]` reference fed back into the picker after the *first* click, resetting its
  in-progress range selection before a second date could be picked — fixed with a local signal as the
  picker's own source of truth, only re-synced from the service when the iso values actually diverge.
  **Second bug, same feature**: the "empty" state was `[null, null]` (truthy, length 2) rather than
  `null` — PrimeNG's `selectDate()` reads `value[0]` as the existing start date whenever `value.length`
  is truthy, and calling `.getTime()` on that `null` threw, silently breaking the very first click.
  Fixed by making the empty/no-selection state genuinely `null`
- **Connection date/time picker** (`connection-leg-picker`): separate date+time inputs replaced with
  one `p-datepicker` (`showTime`, `hourFormat="24"`). Needed `appendTo="body"` (plus a
  `panelStyleClass="leg-datetime-panel"` with `max-height:90vh; overflow-y:auto` in `styles.css`) since
  the connections drawer's own scroll container was clipping the calendar+time panel on mobile —
  matches this codebase's existing `appendTo="body"` convention for portalled PrimeNG overlays
- **Connections drawer**: added a date-range/day-count badge at the top of `connections-drawer.html`,
  mirroring the badge already used in Step 4/5 (`dateMode`/`formattedDateRange`/`dayCount` computeds)
- **Step 2** stop-location placeholder text (`trip.planner.step2.stop`, used both as literal
  `[placeholder]` and as the mobile-view fallback span) changed "Stop location" → "Select a location"
- **Homepage hero**: removed the `hero-badge` (map-marker icon + "Switzerland's finest experiences")
  entirely; later lightened `.hero-overlay`'s gradient (0.45→0.85 opacity down to 0.25→0.65) per
  separate user feedback that the mask read too dark over the photo
- **Header brand**: added `as_logo.png` before the "ActivSwitzerland" text (`.brand` → inline-flex,
  new `.brand-logo`); hamburger toggle swapped from PrimeNG `p-button`/`pi-bars` to a plain
  `<button><i class="fa-solid fa-bars-staggered">` — removed the `!important` background/hover
  overrides in the same pass since a plain button needed no PrimeNG-class fighting to stay transparent
- **Favicon**: confirmed `frontend/public/favicon.ico` (not `src/assets/`) is the one `index.html`
  actually references, since `public/**` copies to the build root while `src/assets/**` copies under
  `/assets/`. User replaced the file directly (16×16 `.ico`)
- **Hike/bike distance display** — iterated a few rounds based on live feedback:
  - New `formatDistanceKmMi()` (`shared/utils/distance.ts`, 1-decimal "35.3 km / 21.9 mi", kept
    separate from the existing whole-number `formatDistance()` used by trip cards) put on the far left
    of the `.trail-attribution` row on `hikes-list`/`bikes-list` cards (a `.trail-distance` span that
    used to sit next to the category badge was removed per correction — distance only shows in the
    attribution row now)
  - Added a `distanceLabel` input to the shared `MapComponent` (bottom-left overlay badge). First pass
    only wired it into `hike-detail`/`bike-detail`'s small embedded thumbnail map and the user
    correctly reported not seeing it — the map users actually browse on is a *separate*, primary
    full-screen `<app-map>` in `destinations-layout.ts`, driven by its own `trailRoute`/`trailColor`
    computeds (selected marker or "see all stages" overview). Added a matching `distanceLabel`
    computed there too, resolving from whichever is active — `TrailRoute.distanceKm` already sums
    every stage of a multi-day route, so this is correct for stage-overview mode with no extra work.
    Mobile media query bump (`bottom: 74px` under 599px) added to clear the fixed footer nav, mirroring
    the existing zoom-control offset
  - Hike/bike detail cards' `.trail-detail-distance` switched from km-only to the same
    `formatDistanceKmMi()`-backed `distanceLabel()` used by the map badge, adding mi there too
- **GPX download auth gate**: `hike-detail.ts`/`bike-detail.ts`'s `downloadGpx()` now checks
  `auth.isLoggedIn()` first and opens the `'auth'` drawer if not, mirroring the existing
  `step5-save`/`trip-card` pattern; lock icon + sign-in hint shown under the button when logged out
  (new `hikes.downloadGpxSignInHint`/`bikes.downloadGpxSignInHint` i18n keys)
- **Step 5**: removed the "Browse Saved Trips" button/`browseSavedTrips()`/now-unused `LangService`
  injection and i18n key
- **Bundle size optimization** — a `budgets`-warning investigation that turned into real work across
  three rounds:
  1. Converted `destinations/:id` and `trip-planner`(`/:id`) from eager `component:` to
     `loadComponent()` in `app.routes.ts`, plus `withPreloading(PreloadAllModules)` in `app.config.ts`
     — initial bundle 2.72MB→2.48MB. Not enough on its own: `MainLayout` (wraps every route) always
     renders `<app-drawer-host>`, which eagerly imported `HikeDetail`/`BikeDetail` (pulling in
     `MapComponent`→maplibre-gl) regardless of which route was active
  2. Wrapped `HikesList`/`HikeDetail`/`BikesList`/`BikeDetail` in `@defer (on idle; when
     svc.isOpen(...))` blocks in `drawer-host.html` (new `.drawer-defer-loading` spinner placeholder).
     `HikesList`/`BikesList` split into lazy chunks immediately; `HikeDetail`/`BikeDetail` didn't —
     root-caused to `drawer-host.ts` importing them in the *same statement* as their `*Payload` types
     (`import { HikeDetail, HikeDetailPayload } from ...`), which made Angular's compiler conservatively
     keep the class eager since the type was referenced outside the defer block. Fixed by splitting
     into separate `import`/`import type` statements — verified by rebuilding and confirming named
     `hike-detail`/`bike-detail` lazy chunks appeared
  3. Bundle only dropped ~20KB despite that fix — traced to two more unrelated eager consumers of
     `MapComponent`: `destination-vertical-list.ts` (`/destinations` list, one embedded map per card)
     and `trip-card.ts` (`/explore-trips`), both still eager `component:` routes. Converted both to
     `loadComponent()` too — **initial bundle 2.43MB→1.58MB**, confirming maplibre-gl really was the
     dominant contributor once every consumer was accounted for
  - Final cleanup once the user confirmed both remaining warnings were expected, not regressions:
    `angular.json` budget raised 1MB→1.75MB (reflects the new real baseline with headroom) and
    `"allowedCommonJsDependencies": ["maplibre-gl"]` added (acknowledges the CJS-tree-shaking warning
    as an accepted, unavoidable characteristic of the library rather than an oversight)
- Also fixed in passing: unused `DecimalPipe` import removed from `hikes-list.ts`/`bikes-list.ts`
  (NG8113 warning) after the `.trail-distance` span using the `number` pipe was deleted
- Verified via `ng build` (dev config after most changes; full production build, checking actual chunk
  names/sizes, for the bundle-optimization work specifically) after every round; user live-tested each
  round in the browser and reported real bugs/corrections back in turn (the range-picker null-state
  bug, the map-badge-on-wrong-map miss, the distance-value/mi corrections) rather than everything
  landing right first try
- Not yet committed at time of writing this entry; branch to be merged to `main` and deleted after



- No feature branch/spec — three independent, user-directed changes made directly on `main` in one session
- **SchweizMobil/ASTRA attribution**: verified live against geo.admin.ch's `layersConfig` endpoint
  that `ch.astra.wanderland`/`veloland`/`mountainbikeland` all attribute to `"ASTRA + Kanton"` (not
  "SchweizMobil" as first assumed — that's the trail-network brand, not the geodata's own citation).
  User chose to credit the brand name anyway, localized per UI language. Added
  `hikes.attribution`/`bikes.attribution` i18n keys (en: "© SwitzerlandMobility", de: "© SchweizMobil",
  fr: "© SuisseMobile", it: "© SvizzeraMobile") and a full-width, right-aligned `.trail-attribution`
  strip (darker `--gray-200` background) on every card in `hikes-list.html`/`bikes-list.html`. Noted
  for later: this is unconditional today since every route currently comes from geo.admin.ch — will
  need gating on a route `source` field once DB-backed hikes are added
- **MySwitzerland image copyright risk accepted**: user re-read the Open Data API ToS (uncredited
  images assumed copyrighted; usage confined to "the respective data set") and decided to accept the
  risk of showing images without a `copyrightHolder`, matching myswitzerland.ch's own usage context.
  `stripNonCompliantImagesFromResponse` in `backend/src/controllers/myswitzerland.js` is now a no-op
  (body commented out, single toggle point, all 7 call sites untouched) rather than deleted, so the
  `feature/image-copyright-compliance` filter can be restored in one uncomment if MySwitzerland
  objects. Frontend needed no change — the `© {{img.publisher}}` caption already no-ops when absent
- **Image loading performance**: confirmed via a live API call that MySwitzerland images ship at full
  original resolution (3000px+ wide) with no documented resize/variant parameter (checked against the
  API's own published `ImageObject` schema). Converted every CSS `background-image` usage for
  MySwitzerland-sourced images to real `<img loading="lazy" decoding="async">` elements across
  `destination-detail`/`attraction-detail` (galleria + thumbnails, main image gets `eager`+
  `fetchpriority="high"`), `destination-vertical-list`, `destination-horizontal-list`,
  `destination-search-results`, `attraction-search-results`, `attraction-vertical-list`,
  `all-attractions` — `object-fit: cover` replacing `background-size: cover`. Three of these
  (`destination-vertical-list`'s card badges, `destination-horizontal-list`'s card badges, both
  galleria captions) overlay text on top of the image: restructured with the image
  `position: absolute` behind the text, text given explicit `z-index: 1`; `.galleria-img` additionally
  needed `overflow: hidden` added since border-radius no longer auto-clips a separate `<img>` child
  the way it did a CSS background. Actually reducing bytes transferred (server-side resizing) was
  explicitly deferred as a separate decision — would mean proxying/caching resized copies ourselves,
  a more active form of reproduction than linking straight to MySwitzerland's own CDN
- Verified via `tsc --noEmit` and `ng build --configuration production` (clean, same pre-existing
  bundle-size/CommonJS warnings) after each change; user browser-verifying the image-loading visual
  result themselves
- Not yet committed

### 2026-08-07 — Desktop Responsive Redesign: Phases 0, 1 (full), 3 (partial) Implemented

- Branch: `feature/desktop-split-view-foundations`; master plan
  `context/features/desktop-responsive-redesign-spec.md`, phase specs
  `desktop-redesign-phase0-foundations-spec.md`, `desktop-redesign-phase1-drawer-rollout-spec.md`,
  `desktop-redesign-phase3-homepage-cards-spec.md` (all under `context/features/`)
- Preceded by a full-app desktop-responsiveness audit (spawned Explore agent) and the master plan
  itself, drafted before any code changes. Two confirmed decisions via `AskUserQuestion` before
  starting implementation: map/content drawers become a persistent non-modal split-view sidebar at
  desktop (not just a wider overlay drawer); layout code adopts Tailwind v4 responsive utilities
  where practical (existing PrimeNG-portal CSS overrides stayed plain CSS where Tailwind isn't a
  good fit, e.g. `::ng-deep` targeting)
- **Phase 0** — new `Breakpoint` service (`shared/services/breakpoint.ts`, `SPLIT_VIEW_MIN_WIDTH =
  1280`, matches Tailwind's `xl`, SSR-safe via `isPlatformBrowser`). Prototyped the split-view
  mechanism on `destination-detail`: read PrimeNG's own source (`primeng-drawer.mjs`) to confirm
  `[modal]="false"` skips creating the scrim entirely (no mask ever appended to `<body>`), so toggling
  it off at desktop docks the panel non-modally below the header instead of overlaying the whole
  screen — no map-layout rebuild needed. First pass only removed the scrim (map stayed full-bleed,
  hidden behind the panel); user tested live and expected the map to visibly reflow too, so
  `destinations-layout`'s map container also shifts its left edge 600px when docked (new
  `sidebarDocked` computed), backed by a new `ResizeObserver` in `shared/map/map.ts` (MapLibre doesn't
  watch its own container, and this resize isn't driven by an `@Input`)
- **Phase 1** — rolled the identical mechanism out to every other drawer `destinations-layout` hosts
  (All-Attractions, Attraction Detail, Weather, Hikes, Hike Detail, Bikes, Bike Detail, Hotels), then
  to `trip-planner-layout` (map and wizard used to be mutually exclusive in the template — `@if
  (!wizardVisible) map @else wizard, full-viewport-width`; now both mount together at desktop, wizard
  docked at a fixed 600px via new `wizardDocked`/`showMap` computeds) and its Connections drawer
  (widened 480px→600px to match, since it's always opened while the wizard stays visible and needs to
  fully cover the same docked slot)
- Four real bugs found via live user testing on this branch, all fixed:
  - Map/header seam on both `destinations-layout` and `trip-planner-layout` — `.map-wrapper`'s
    `inset: 0` replaced with an explicit `top: 4.5rem`/`3.5rem` respectively instead of relying on
    z-index alone to hide any overlap behind the header
  - `footer-nav.css` only ever hid the footer's *buttons* at ≥600px, never the bar itself, leaving an
    empty navy strip at the bottom of every desktop page — fixed to hide the whole `.footer-nav`, plus
    cleaned up three now-dead footer-clearance offsets that were reserving space for it
    (`home.css`, `trip-planner-layout.css`, `map.css`'s zoom-control offset)
  - Leftover-open-drawer-on-navigate: both layout components' `ngOnDestroy()` only ever closed one
    drawer key each (`destination-detail` / none at all), so any other drawer left open when
    navigating away (e.g. the header brand link) kept rendering on top of the next page — fixed by
    closing every key each page can open
  - Stuck-modal-mask race: the six `[modal]` bindings gated on `isXTripPlanner()` (a computed reading
    a drawer's own payload) flipped to a stale `false` in the same change-detection cycle
    `Drawer.close()` synchronously deletes that payload, so PrimeNG's `hide()` sometimes read the
    already-updated value and skipped `disableModality()`, leaving an invisible mask permanently
    blocking clicks on whatever rendered underneath — fixed with a `stickyModal()` helper
    (`drawer-host.ts`) that only updates a drawer's modal flag while it's actually open, never during
    its own close transition
- **Phase 3 (partial)** — pulled forward ahead of Phase 2 at the user's choice, once Phase 0/1 were
  confirmed working. Established a shared container-tier convention (900px at ≥1024px, 1300px at
  ≥1536px) reused across four pages: homepage destination-card rails (`destination-horizontal-list`,
  all 3 rails — horizontal-scroll strip capped at 200px replaced with an `auto-fit`/`minmax` grid,
  settling at 2 columns, ~640px cards at the top tier, confirmed by the user as the intended "~4x
  mobile size" result); `/search` (container gained the 1300px tier, result rows grow
  110px→140px→170px with matching text-size bumps, `.card-photo` grows for free as a % of the row);
  Explore Trips (gained the container itself — previously full-width/uncapped — and had its 1100px
  3-column jump removed outright, staying at 2 columns/"pairs" per the user's request; `trip-card`
  untouched since its width already came from the grid column); profile page (new `.profile-content`
  wrapper in `profile.html` around everything below the hero banner — hero itself deliberately left
  full-bleed, not asked to be contained)
- Verified via `tsc --noEmit` after every change (always clean) plus confirming each change was
  actually present in the live dev server's served bundle (`curl` the running `ng serve` + `grep`
  against `main.js`/`styles.css`) before asking the user to browser-test, rather than assuming a save
  had taken effect; user live-tested and confirmed (or reported real bugs from) each round in turn
- Not yet committed. Remaining master-plan scope: Phase 2 (trip-planner wizard steps 1–5 internal
  spacing/typography tuning), rest of Phase 3 (`destination-vertical-list`, profile's saved-trips grid
  column count), Phase 4 (shared component library, dedupe `.reopen-btn`/`.destination-card`), Phase 5
  (global desktop nav bar for `header-nav`)

### 2026-08-05 — Explore Trips (Phases A–D) Implemented

- Branch: `feature/explore-trips`; spec: `context/features/explore-trips-spec.md`. Built all four
  phases on this one branch rather than the spec's original per-phase-branch plan — asked the user
  when Phase B was starting whether to merge Phase A to `main` first (matching the nights-here
  precedent) or keep going on the same branch; user chose to keep building on one branch and merge
  once, so Phases B–D landed on top of Phase A's uncommitted work instead of each getting its own
  branch off `main`
- **Phase A** — `backend/src/models/Trip.js` gained `isPublic`/`anonymous`/`review`/`likes`/
  `distanceKm`; new `backend/src/utils/geo.js` (haversine) computes `distanceKm` server-side in
  `createTrip`/`updateTrip`, `updateTrip` also strips any `likes` field from the request body
  (only the Phase B like-toggle endpoint may change it). Step 5 Save gained "Make trip public"/
  "Stay anonymous" toggles. Profile's Saved Trips cards gained a review section (collapsed by
  default at first, later changed to open by default in Phase D's UAT round) and a like-count
  badge; the old hardcoded "Reviews liked: 34" stat was replaced with a real `likesReceived` (sum
  of likes across the user's own trips) at the user's explicit request, to incentivize going public
- **Phase B** — new `optionalAuth` middleware; `backend/src/routes/trips.js` restructured off the
  blanket `router.use(protect)` to per-route auth; `GET /trips/public` (paginated, privacy-filtered
  creator info) and `POST /trips/:id/like` (toggle). **Real bug found via manual testing**:
  `req.cookies.token` threw `Cannot read properties of undefined` — `cookie-parser` was never
  registered in `server.js` (not even a dependency); `protect` had the same latent bug but never
  hit it since every real request already carries an `Authorization` header, while `optionalAuth`
  is the first code path that legitimately runs with neither. Fixed both call sites with
  `req.cookies?.token`
- **Phase C** — rewrote the `ExploreTrips` stub into an `IntersectionObserver`-driven infinite
  scroll grid (50/batch) plus a bottom-position filter drawer (`'explore-trips-filter'` — the
  app's first `position="bottom"` drawer)
- **Phase D** — new `trip-card` (CSS 3D flip, map front face, `trip-timeline` back face) and
  `trip-timeline` (PrimeNG `p-timeline`) components
- **Real bug found via user testing, twice**: `Drawer.close()` unconditionally deletes a drawer's
  payload. First hit on the filter drawer's X-button/backdrop dismiss (fixed inline in
  `drawer-host.ts`); then the user reported "none of the filters do anything" — turned out
  `explore-trips-filter.ts`'s `apply()`/`resetFilters()` had the *exact same* bug
  (`setPayload(newFilters); close();` — the close() call immediately erased what setPayload() just
  set), just missed applying the same fix there. Fixed properly this time with a new
  `Drawer.closePreservingPayload()` on the shared service instead of patching each call site, and
  switched both existing call sites to use it
- **UAT round** (after Phases C/D first went live) produced a long list of fixes: header/filter-icon
  spacing (`.et-page` top padding 56px → 80px); dates switched from dashes to dots app-wide
  (`formatDdMmYyyy()` in `shared/utils/date-range.ts` itself changed to `.` separators — user
  clarified they wanted this everywhere, not just Explore Trips, after an initial
  Explore-Trips-only `formatDdMmYyyyDot()` variant was removed again in favor of one shared
  function); map activity markers switched from a generic star icon to the same attraction/hike/
  bike PNG icon set used elsewhere (`ACTIVITY_GROUPS` from `step4-summary.ts`, exported for reuse);
  review expanded by default (was collapsed) with a new "No review available." fallback string;
  like icon color fixed to `#d97706`; tapping anywhere on the card now flips it (not just the flip
  button — click on `.tc-card` bubbles to `toggleFlip()`, with `stopPropagation()` on the like
  button/review toggle/map so those don't also flip); timeline rebuilt from a two-column
  opposite/content layout to a single column (marker/line flush left, destination+date+activities
  stacked in one right-hand column — required `::ng-deep` hiding `.p-timeline-event-opposite`,
  which PrimeNG always renders at `flex:1` even with no template supplied) and day-number labels
  now only show in 'days'-mode trips, never alongside a real calendar date; road/rail badge colors
  swapped site-wide (green=rail, blue=road — matches the map's own route-line colors, which were
  already correct) in both `profile.html` and `trip-card.html`; Explore Trips' review-toggle label
  changed to "Traveller review" (Explore-Trips-only key, profile page's own "Review" label left
  alone); footer-nav fixed to show on `/explore-trips` — turned out `FooterNav.isFooterNavRoute()`
  gates the whole footer behind an explicit route allowlist (`/`, `/destinations`, `/search`,
  `/trip-planner`) that `/explore-trips` had simply never been added to
- Verified via `tsc --noEmit`/`node --check` after every change, plus extensive live verification
  using a headless Chromium instance (network-request inspection, DOM/computed-style checks,
  screenshots) to confirm fixes before handing back to the user rather than guessing — this is how
  the two Drawer payload-deletion bugs and the stale-dev-server issue (see below) were root-caused
  precisely rather than by trial and error
- **Also found, unrelated to Explore Trips' own code**: early in Phase D's UAT the user reported
  seeing nothing at `/explore-trips` at all — traced to their running `ng serve` simply not having
  picked up the source changes (confirmed by loading the page headlessly and finding the literal
  old stub markup still being served); resolved by the user restarting their dev server, not a
  code fix
- Not yet committed

- Branch: `feature/trip-planner-nights-here`; specced in the entry directly below
- `shared/utils/date-range.ts`'s `stopDayRanges()`: day pointer now starts at `1` (was `0`); a real
  (>0 night) stop's span now starts *at* the pointer rather than *after* it. Matches the spec's
  worked example — a leading or mid-trip transit stop shares a day with the stay it leads into
  instead of getting an orphan "Day 0"/day of its own; every no-transit case is byte-for-byte
  identical to the old output
- i18n value-only changes across en/de/fr/it: `daysHere` → "Nights here" family;
  `dayRemaining`/`daysRemaining`/`dayOverBudget`/`daysOverBudget` → "night(s)" wording. Keys
  unchanged, so `stopDayOptions()` and every `stopDayRanges()` caller (Step 2/3/4) inherited the fix
  with no other file changes needed, as planned
- Extra fix bundled into the same working tree, not in the original spec: `step2-itinerary.ts`
  re-picking a new place into an already-populated departure/via/destination slot keeps the same
  `TripStop.id` (so its days/role/order survive the swap), which meant any activities or rail
  connections keyed by that id from the *old* place would silently carry over and appear to belong
  to the new one. Fixed with a new `clearStaleStopData()` (clears activities+connections for the
  stop only when the picked coordinates actually change, not on a no-op re-pick of the same
  suggestion) called from `applyDeparture`/`applyDestination`/`applyVia`, plus explicit
  `removeActivitiesForStop()` calls on `onDepartureClear`/`onDestinationClear`/`removeVia`. New
  `TripPlannerService.removeActivitiesForStop()`/`removeConnectionsForStop()` helpers backing this
- No `TripStop`/`PlannedTrip` model changes; no markup/CSS changes
- Verified via `tsc --noEmit` (clean); not yet live-tested in-browser or committed

### 2026-08-04 — Trip Planner Step 2: Nights Here Relabel + Day-0 Fix Specced

- User flagged that "Day 0" (shown when a transit/pass-through stop has nothing allocated before
  it) reads wrong — a trip's starting point is Day 1 even when the traveler isn't sleeping there.
  Proposed switching Step 2's "Days here" input to "Nights here" framing, both to resolve the Day-0
  labeling and because nights-per-stop is the unit the planned hotel-selection feature will need
  (checkout = arrival + nights)
- Investigated `stopDayRanges()` (`shared/utils/date-range.ts`): the existing algorithm already
  treats a 0-day stop correctly in spirit (borrows the "current day" instead of claiming one of its
  own) — the only real defect is the day pointer starting at `0`. Traced every consumer
  (`stopDayOptions()`, Step 2/3/4's `stopDayLabels`) and confirmed they all read `stopDayRanges()`'s
  `{start, end}` output as-is, so the fix is fully contained to that one function
- Designed the fix: pointer starts at `1`; a real (>0 night) stop's span starts *at* the pointer
  rather than *after* it, so a leading or mid-trip transit stop shares a day with the stay it leads
  into instead of getting its own orphan day. Verified against a worked 5-night example (transit →
  Lucerne(2) → transit → Interlaken(3)) and confirmed the no-transit case is byte-for-byte identical
  to today's output
- Scoped the i18n relabel: `daysHere` and the four remaining/over-budget keys switch to "night(s)"
  wording across en/de/fr/it (value-only, keys unchanged); `tripRange`/`daysTrip`/`dayLabel`/
  `dayRangeLabel`/`dayDateLabel` explicitly left alone since they describe the trip's overall length
  or the resolved calendar-day output, not the per-stop night count
- No `TripStop` model changes (field stays `days`), no Step 3/4 code changes (inherit the fix via
  the shared `stopDayRanges()` import), no CSS changes expected
- Created `context/features/trip-planner-nights-here-spec.md` and branch
  `feature/trip-planner-nights-here`; no implementation started

### 2026-08-03 — Auth: Header Restyle + Email Verification + Profile Email-Change Implemented

- Branch: `feature/auth-email-verification`; specced in the entry directly below
- Implemented the spec's `verificationCode.js`/`register`/`login`/`verifyEmail`/
  `resendVerification`/`updateUser`/`verifyEmailChange` backend endpoints, the shared
  `verify-code` component, and wired `profile.ts` to real `getMe`/`updateUser` calls (was 100%
  hardcoded)
- **Real bug found via live UAT, not caught by `tsc`/build**: editing the email on the profile
  page 500'd with a raw SMTP error (`Invalid login: 535 Authentication failed`) instead of saving
  anything — `updateUser` awaited `sendVerificationEmail` inline, so a mail-send failure (bad
  local SMTP creds in `backend/config/.env`) threw before `user.save()` ran, losing valid
  unrelated field edits (name/country/etc.) too, and `errorHandler` echoed nodemailer's raw
  internal error text straight to the client. Fixed by wrapping the email-change
  create-code+send-email step in `updateUser` in try/catch: other profile fields now always save;
  on failure the response is a normal `200` with a new `emailUpdateError` string (server logs the
  real error) instead of a `500`. Frontend (`UpdateUserResponse.emailUpdateError`,
  `profile.ts`'s `saveEdit`/`onResendEmailChange`) surfaces it via toast. SMTP credentials
  themselves were left to the user to fix in their local `.env` — not a code issue
- **Real bug found via live UAT**: the nav-menu drawer wouldn't open from `/auth/profile` —
  clicking the hamburger did nothing until navigating to another page, at which point it opened
  immediately. Root cause: `auth/profile` was a sibling route of `MainLayout` instead of nested
  under it, so `app-drawer-host` (only rendered inside `MainLayout`) was never in the DOM on that
  route — `Drawer.toggle()` flipped shared service state with nothing listening; navigating into
  a `MainLayout`-nested route then picked up the already-open state. Fixed by moving `auth/profile`
  into `MainLayout`'s `children` in `app.routes.ts`, which also meant removing `profile.html`'s
  own duplicate `<app-header-nav>`/`<app-footer-nav>` (previously needed since it wasn't inside
  `MainLayout`) and the now-unused imports from `profile.ts`
- forgot-password's drawer still used the pre-restyle light `.menu-header` (same as the nav-menu
  drawer) instead of the navy `.auth-header` now used by login/register. Fixed in
  `drawer-host.html`: added `styleClass="auth-drawer"` and swapped to the `.auth-header` markup —
  incidentally also fixed a latent visual gap, since `forgot-password.css`'s `.fp-hero`/`.fp-card`
  were already built for the flush-navy-header + overlapping-white-card pattern (matching
  `auth-layout.css`'s `.auth-strip`/`.auth-card`) but weren't getting the padding-free header
  needed to actually render that way
- UAT polish on `forgot-password`: removed the key-icon circle above "Reset your password" (dead
  `.fp-icon-circle` markup+CSS deleted); `.fp-hero` height reduced `200px` → `140px` to match the
  lighter content now that the icon is gone
- Investigated (not implemented, reverted): a desktop-responsive pass on the trip planner wizard
  (`trip-planner-wizard.css`), live-tested at 640px and 1024px max-widths via headless-Chromium
  screenshots. User's conclusion: widening the container alone doesn't fix "everything looks
  small on desktop" — the cards/icons/type themselves are mobile-proportioned and need to reflow,
  not just stretch, and doing that properly across all ~45 component stylesheets (only 12 have any
  `@media` query today) is a separate, deliberate piece of work — explicitly not wanted on this
  branch. Fully reverted, no diff landed
- Verified via `tsc --noEmit` (frontend) and `node --check` (backend) after each change; live
  browser-tested by the user throughout. Not yet committed

### 2026-08-03 — Auth: Header Restyle + Email Verification + Profile Email-Change Specced

- Explored current auth stack: `frontend/src/app/features/auth/*` (auth-layout, login, register,
  profile), `core/services/auth.ts`, and the backend `auth` controller/routes/model. Found the
  `auth-layout` hero is not routed — it's rendered globally in `shared/drawer-host` and toggled via
  the `Drawer` service's `'auth'` key. Found `profile.ts`'s `user` object and `saveEdit()` are
  entirely hardcoded, no `getMe`/`updateUser` wiring exists yet. Found the backend already has
  Redis (`redis@6`, connected, used today for response caching) and nodemailer/Mailgun email
  sending fully configured — confirmed as reusable, not new infra
- Found a real pre-existing gap: `User.isValid` defaults `false` and gates `login()` with a 403,
  but nothing anywhere ever sets it `true`, and `register()` issues a full JWT immediately
  regardless — an inert/self-contradicting half-built email-confirmation stub
- Asked the user via `AskUserQuestion` whether the new code-based verification should be one-time
  (fixing the dead `isValid` gate) or full 2FA-on-every-login; user asked for a recommendation,
  advised one-time is the standard pattern for a consumer trip-planning site (2FA-every-login is
  disproportionate friction for this type of app) — user agreed on one-time
- Asked whether profile's email-change verification should also include wiring `profile.ts` to a
  real `getMe`/`updateUser` backend call (previously entirely hardcoded) as prerequisite scope —
  user confirmed yes
- Designed (via a Plan sub-agent, cross-checked directly against `errorResponse.js`/`error.js`,
  `rateLimiter.js`, `redis.js`, `cache.js`, `sendEmail.js`, `auth.ts`, `drawer.ts`, `profile.ts`):
  a generic `backend/src/utils/verificationCode.js` (Redis-keyed `verify:{prefix}:{id}`, 5-min TTL,
  5-attempt cap before forcing a resend) reused by both flows; rewritten `register`/`login`/
  `updateUser` controllers plus new `verifyEmail`/`resendVerification`/`verifyEmailChange`
  endpoints; a new shared `verify-code` frontend component (PrimeNG `p-inputotp`) used both inside
  `auth-layout` (register/login) and inline on the profile page (email-change)
- Real correction caught during design: the plan initially assumed `next(new ErrorResponse(...))`
  could carry extra response fields (`verificationRequired`, `email`) on the 403 login-unverified
  path — reading `errorResponse.js`/`error.js` directly showed the error middleware only ever
  echoes `{ success:false, err:message }`, discarding anything else. Fixed by sending that specific
  response directly via `res.status(403).json(...)` instead of going through `next()`
- User asked for one consolidated spec file rather than the three separate layout/wireup-style
  specs initially proposed (matching this repo's usual split convention) — created
  `context/features/auth-email-verification-spec.md` covering all three changes together. User
  also asked to hold off on creating the feature branch until told to
- No feature branch created yet; no implementation started

### 2026-08-01 — Trip Planner Step 2/3: Start/End Trip Relabel + Transit Checkbox Implemented

- Branch: `feature/trip-planner-itinerary-transit`; spec: `context/features/trip-planner-itinerary-transit-spec.md`.
  The hike/bike detail map change (entry below) ended up combined onto this same branch's working
  tree mid-session, at the user's request, so both could be live-tested together in one running app
- i18n: `trip.planner.step2.departure`/`destination` values changed "Departure"→"Start trip",
  "Main Destination"→"End trip" across en/de/fr/it (keys unchanged, so Step 3's per-stop role
  label — which reuses the same keys — picks up the rename for free); new
  `trip.planner.step2.transit` key ("Transit", "Transito" in Italian)
- `step2-itinerary.ts`: new `isTransit(stop)` (derived — checked iff `days === 0`, no new
  `TripStop` model field) and `onTransitToggle()` (sets days to `0` when checked,
  `DEFAULT_STOP_DAYS` when unchecked); `applyDeparture()`'s first-pick fallback changed from
  `DEFAULT_STOP_DAYS` to `0` so a freshly-picked departure defaults Transit-checked (picking a
  *different* location into an already-populated departure slot still leaves its existing days
  untouched, same as before)
- `step2-itinerary.html`: new Transit checkbox on the departure and via-stop cards only (not the
  destination card, which already shows unconditionally in Step 3); Days-here input gains
  `[disabled]="isTransit(stop)"`
- `step3-activities.ts`: `visibleStops` changed from a blanket `days > 0` filter to role-aware —
  departure still hides at 0 days, via/destination stops now always show even at 0 days, so they
  stay addable as same-day pass-throughs
- UAT round after the user tested live, two real bugs found and fixed:
  - Requested gap tweak (checkbox closer to its "Transit" label, 5px) turned out to already be
    ~correct (`0.3rem` ≈ 4.8px) — the real bug was `.s2-days-field input`/`label` being bare
    descendant selectors that also matched the checkbox/label nested inside `.s2-transit-field`,
    inheriting the days-count input's `width: 3.5rem`/padding and inflating the checkbox's own box
    far beyond its visual glyph, which is what actually read as a big gap. Root-caused (rather than
    guessed) by rendering the exact markup+CSS standalone in a headless browser (`npx playwright
    screenshot`) and comparing bounding boxes before/after. Fixed by scoping both rules to
    `.s2-days-field > input`/`> label` (direct-child selectors)
  - See the hike/bike map entry below for the `MapComponent` `interactive` input revert, also found
    via this same live-testing round
- Verified via `tsc --noEmit` and `ng build` after every round; not yet committed

### 2026-08-01 — Hike/Bike Detail: Real Map Instead of Gray Thumbnail Implemented

- Branch: originally `feature/hike-bike-detail-map`; spec: `context/features/hike-bike-detail-map-spec.md`.
  Ended up combined onto `feature/trip-planner-itinerary-transit`'s working tree (entry above) for
  combined live testing, at the user's request — not yet split back into its own branch/commit
- `hike-detail.ts`/`bike-detail.ts`: dropped `TrailThumbnail`, added `trailLines`/`trailColor`/
  `fitBoundsCoords` computeds off `payload()`, mirroring `destinations-layout.ts`'s existing
  `collectLines()`/`trailRoute` computed pattern for the full-page background map's own route line
- `hike-detail.html`/`bike-detail.html`: `.trail-detail-thumb-wrap` now renders
  `<app-map [trailRoute] [trailColor] [fitBounds]>` instead of `<app-trail-thumbnail>`;
  `.trail-detail-thumb-wrap` CSS gained `position: relative` (`MapComponent`'s `:host` is
  `position: absolute; inset: 0`, needs a positioned ancestor to fill)
- Initially shipped with a new `MapComponent` `[interactive]` input (disabling scroll-zoom/drag-pan/
  pinch and hiding `NavigationControl`) to keep the embedded map from fighting the drawer's own
  scroll. User tested live and asked for pinch/pan back, so the whole `interactive` input was
  reverted out of `map.ts` entirely (no caller ended up using `false`) rather than left as dead code
  — both maps are now fully interactive, same as every other `app-map` usage in the app
- `shared/trail-thumbnail/` untouched — still used by `hikes-list`/`bikes-list` card thumbnails
- Verified via `tsc --noEmit` and `ng build` after each round; not yet committed

### 2026-07-31 — SEO Locale Routing + hreflang (Phase 2) Implemented

- Branch: `feature/seo-locale-routing-hreflang`; specced in the entry directly below
- `shared/services/lang.ts` rewritten: exports `SUPPORTED_LANGS`/`DEFAULT_LANG`/`Lang` and a
  `stripLocalePrefix()` helper; `LangService.current` now derives from `Router.url`'s first
  segment instead of `localStorage`; `.set()` removed (nothing left to call it — the route
  resolver now drives `translate.use()`); new `localize(commands)`/`navigate(commands, extras)`
  centralize prepending the current locale onto route commands for the ~24 navigation call sites
  identified in the spec (components inject `LangService` and call these instead of
  `Router.navigate`/bare `routerLink`s)
- New `core/guards/locale.ts`: `localeMatchGuard` (`CanMatchFn`, restricts `:lang` to real
  `en`/`de`/`fr`/`it` segments), `bareLangMatcher` (the inverse, a `UrlMatcher` gating the
  bare-path redirect — see the NG04014 bug below for why this is a matcher and not a guard),
  `localeLangResolver` (`ResolveFn`, calls `translate.use(lang)` from the route's own resolved
  `:lang` param — sidesteps any ordering risk from reading `LangService.current` mid-navigation)
- `app.routes.ts` restructured: every route now sits under a `:lang` parent (`canMatch:
  [localeMatchGuard]`, `resolve: { lang: localeLangResolver }`); a guarded top-level `**` redirects
  anything without a real locale prefix (including bare `/`) to `/en/...`; `authGuard` now
  redirects unauthenticated `/auth/profile` visits to `/${langSvc.current}` instead of always `/`
- **Real bug found via live SSR testing, not caught by `ng build` or `tsc`**: an unmatched deep
  path under a *valid* locale (e.g. `/en/xx`) initially fell out of the matched `:lang` route and
  re-entered the top-level route array to be redirected back in with a locale prefix again —
  empirically this sent Angular's router recognizer into a spin that hung the entire Node process
  (every other in-flight and subsequent request on the same server timed out too, not just this
  one URL — confirmed by killing and restarting the server and reproducing from a clean state).
  Fixed by adding a `{ path: '**', redirectTo: '' }` *inside* `:lang`'s own children, so an unknown
  path resolves to that locale's home entirely within the route it already matched, never
  re-touching the top-level array. Also had to gate the top-level bare-path `**` so it doesn't
  fire a second time for an already-locale-prefixed URL (which would have re-prepended `en`
  forever, e.g. `/en/xx` → `/en/en/xx` → ...) — the two fixes together, verified by re-running the
  exact repro after each change. (This gating was originally a `canMatch` guard; see the NG04014
  bug below for why it became a `UrlMatcher` instead.)
- `app.routes.server.ts`: Home prerenders once per locale (`getPrerenderParams` returning the 4
  fixed codes); `destinations`/`explore-trips`/`search` stay `RenderMode.Server`,
  `trip-planner`/`auth` stay `RenderMode.Client`, all now under `:lang/...` paths
- `SeoService.set()` gains `hreflang` alternate-language `<link>` tags (one per locale + one
  `x-default` → the `/en/...` version), built from `stripLocalePrefix(Router.url)` — removes and
  re-appends all `link[rel="alternate"][hreflang]` tags on every `set()` call, mirroring the
  existing canonical-tag upsert pattern
- Navigation rewired across all ~24 call sites the spec enumerated: `MenuNav`/`FooterNav`/
  `HeaderNav` `routerLink`s now call `langSvc.localize([...])`; `MenuNav.changeLanguage()` rebuilt
  as a real `navigateByUrl()` to the locale-swapped equivalent of the current path+query (was an
  in-place `LangService.set()`); `FooterNav.isFooterNavRoute()` strips the locale prefix before
  its path checks (would otherwise never match once every real path gained a `/de/`-style prefix);
  every imperative `Router.navigate()` in `drawer-host.ts`, `trip-planner-layout.ts`,
  `step5-save.ts`, `home.ts`, `profile.ts`, `destination-vertical-list.ts`,
  `destination-search-results.ts`, and `core/services/auth.ts` (register-redirect) switched to
  `langSvc.navigate()`; `destination-horizontal-list.ts`'s `viewAllRoute` string `@Input` gets a
  `viewAllCommands()` helper stripping its leading slash before `localize()`. `search-page.ts`'s
  query-param-only `router.navigate([], { relativeTo: this.route, ... })` deliberately left
  unchanged — relative navigation with empty commands preserves whatever locale segment is
  already in the URL, no locale-awareness needed there
- `scripts/generate-sitemap.mjs`: emits every URL once per locale (4x the entry count);
  `robots.txt`'s `Disallow` rules changed from bare `/trip-planner`/`/auth` (dead now — no real
  path is unprefixed, so a bare rule would never match again) to one explicit line per locale
  (`/en/trip-planner`, `/de/trip-planner`, etc.) rather than relying on non-standard wildcard
  support
- Verified via `tsc --noEmit`, full `npm run build` (clean; only the pre-existing bundle-size/
  CommonJS warnings; confirmed 4 prerendered locale homepages under `dist/frontend/browser/{en,
  de,fr,it}/index.html`), and extensive live curl testing against the real local backend
  (`activswitzerland_backend` on port 3000) running the built SSR server: bare `/` and bare
  `/destinations` return real `302`s to `/en` and `/en/destinations`; a garbage locale
  (`/xx/destinations`) and a valid-locale-unknown-path (`/en/xx`) both resolve cleanly (the bug
  above, now fixed); `/en`, `/de`, `/fr/destinations` all `200`; the same destination UUID resolves
  correctly with different-language content under `/en/` vs `/de/` (confirms the spec's
  `Destination.identifier` assumption); hreflang tags render correctly with all 4 locales +
  `x-default` plus a correct locale-aware canonical, on both an SSR destination page and the
  static prerendered homepage
- `nginx.conf` needed no changes (its catch-all `try_files` + `index` directive already serves
  per-directory `index.html` transparently, same mechanism already serving root `/` today)
- **Real bug found via the user's own `ng serve`, not caught by `tsc`/`ng build`/curl testing
  above**: `NG04014` at app startup — `redirectTo and canMatch cannot be used together. Redirects
  happen before guards are executed.` The guarded bare-path-redirect route (`{ path: '**',
  canMatch: [bareLangMatchGuard], redirectTo: ... }`) is rejected outright by Angular's route
  config validator; this only surfaces at runtime router construction, not at compile time, so
  every curl check above happened to hit routes that never exercised this specific combination's
  validation path before the server crashed on it for `ng serve` specifically. Root-caused by
  reading the validator's actual source (`node_modules/@angular/router/fesm2022/_router-chunk.mjs`)
  rather than guessing: the check is specifically `route.redirectTo && (route.canMatch ||
  route.canActivate)` — `matcher` isn't part of that check. Fixed by replacing
  `bareLangMatchGuard` (a `CanMatchFn`) with `bareLangMatcher` (a `UrlMatcher`, returning `null`
  for already-locale-prefixed segments instead of gating via `canMatch`) — functionally identical
  gating, just expressed as route-matching instead of a guard, which `redirectTo` is allowed to
  combine with. Verified against the user's own live `ng serve` (which picked up the fix via its
  existing watch process): bare `/` now 302s to `/en` and `/en` itself renders `200` with correct
  content, no NG04014

### 2026-07-31 — SEO Locale Routing + hreflang (Phase 2) Specced

- Phase 2 of the 4-phase SEO plan (Phase 1: SSR foundation, directly above; Phase 3: JSON-LD;
  Phase 4: Search Console/Bing/IndexNow). Phase 1 made pages crawlable but every URL still shares
  one language (`ngx-translate` swaps strings client-side under a single shared route) — real
  `hreflang` requires each language to be its own crawlable URL, which is where most of the
  remaining SEO gain sits for a Swiss DE/FR/IT audience
- Investigated current state: i18n is purely `ngx-translate` (no Angular built-in i18n to
  reconcile); `LangService.current` today just reads `localStorage`/hardcoded `'en'` server-side
  with zero URL involvement; `MenuNav.changeLanguage()` is an instant in-place string swap, no
  navigation; every language-reactive component already listens via
  `translate.onLangChange.pipe(startWith(...))` (wired in Phase 1), so calling `translate.use()`
  from a route guard needs no changes there. Grepped exhaustively: ~24 internal navigation call
  sites (9 `routerLink`s + 15 imperative `router.navigate()` calls) all need to carry the locale
  forward
- Confirmed decisions: all four locales get an explicit prefix including English (`/en/`, `/de/`,
  `/fr/`, `/it/`) — symmetric rather than "English unprefixed" since almost nothing is indexed yet
  post-Phase-1, so there's no continuity cost to avoid; bare paths redirect to `/en/...`
  unconditionally (no `Accept-Language` sniffing — deferred, not required for indexability);
  navigation goes through a new centralized helper (prepends the locale segment to route
  commands) rather than relying on Angular's relative-routing resolution, since several call
  sites (`footer-nav`, `menu-nav`, `drawer-host`) aren't routed components with a clean
  `ActivatedRoute` context; `MenuNav.changeLanguage()` becomes a real navigation to the
  locale-swapped equivalent of the current URL
- Scope: every route gains a `:lang` parent segment (matcher restricted to `en|de|fr|it`, not an
  unconstrained param) with a guard/resolver calling `translate.use(lang)`; `LangService.current`
  switches from `localStorage` to reading the resolved `:lang` route param; Home prerenders once
  per locale (4 fixed codes via `getPrerenderParams`), `destinations`/`explore-trips`/`search`
  stay `RenderMode.Server`, `trip-planner`/`auth` stay `RenderMode.Client`, all now under every
  locale prefix; `SeoService.set()` gains `hreflang` alternate-language link tags (one per locale
  plus `x-default` → `/en/...`); `scripts/generate-sitemap.mjs` emits every URL once per locale
  (4x current entries)
- Out of scope this phase: `Accept-Language` smart redirect, JSON-LD (Phase 3), Search
  Console/Bing/IndexNow (Phase 4), any new translation work, hike/bike standalone detail routes
  (still don't exist)
- Open items flagged as needing live verification during implementation, not guessable from
  static analysis: whether `@angular/ssr` propagates the bare-`/` redirect as a genuine HTTP 30x
  during SSR or just renders the target content at the original URL; whether
  `Destination.identifier` (a bare UUID) resolves identically regardless of the `language` query
  param; exact behavior of `robots.txt`'s existing `Disallow` path-substring rules once a
  `/de/`-style prefix sits ahead of `/trip-planner`/`/auth`
- Created `context/features/seo-locale-routing-hreflang-spec.md`; no feature branch created yet —
  not yet reviewed/approved by the user, no implementation

### 2026-07-31 — SEO SSR Foundation (Phase 1) Implemented

- Branch: `feature/seo-ssr-foundation`; specced in `context/features/seo-ssr-foundation-spec.md`.
  Phase 1 of a 4-phase SEO plan (Phase 2: path-based locale routing/hreflang; Phase 3: JSON-LD;
  Phase 4: Search Console/Bing/IndexNow) — the app was a pure client-side SPA with no SSR, no
  per-page metadata, and no `robots.txt`/`sitemap.xml` before this
- `ng add @angular/ssr` required bumping the whole Angular stack `21.2.9` → `21.2.19` first
  (peer-dependency conflict between the latest `@angular/ssr` and the pinned core version);
  `ng update`'s own install step crashed on a broken `listr2`/`log-update` dependency, resolved
  with a clean `rm -rf node_modules && npm install` instead
- SSR surfaced three real, pre-existing browser-global bugs (nothing related to prerendering
  specifically — these would have broken any SSR approach), all fixed via `isPlatformBrowser`
  guards: `core/services/auth.ts`/`shared/services/lang.ts` called `localStorage` directly in
  field initializers, crashing immediately since `Auth` is injected by `footer-nav`/`menu-nav`
  (rendered on every page); `shared/map/map.ts` called `new maplibregl.Map(...)` unconditionally
  in `ngAfterViewInit` (no WebGL/canvas under Node); `features/attractions/all-attractions/
  all-attractions.ts` used `IntersectionObserver` unconditionally — this component turned out to
  be always instantiated in the DOM behind its drawer regardless of open/closed state
- New `shared/services/seo.ts` (`SeoService`) wraps `Title`/`Meta`: title, description, canonical
  link, OG/Twitter tags, `noindex` robots meta. Wired into `Home`, `DestinationVerticalList`,
  `DestinationsLayout` (dynamic, from the fetched `Destination`), `TripPlannerLayout`/`Profile`
  (`noindex`, personal/authenticated content), `ExploreTrips`/`SearchPage`. New `seo.*` i18n
  namespace across en/de/fr/it
- SSR-specific plumbing: new `shared/services/i18n-loader.ts` (`I18nLoader`) replaces
  `provideTranslateHttpLoader` — browser still fetches `/i18n/{lang}.json` over HTTP, but the
  server branch statically imports the same JSON files directly (`resolveJsonModule: true` added
  to `tsconfig.json`) rather than trying to fetch them, since there's no live server to fetch
  from during build-time prerendering; `provideHttpClient` gained `withFetch()` (SSR has no XHR
  backend); new `core/interceptors/ssr-base-url.interceptor.ts` rewrites relative API URLs to an
  absolute `SSR_API_URL`-sourced origin server-side, since relative-URL auto-resolution needs a
  live incoming request to derive an origin from (doesn't exist during build-time prerendering)
- New `scripts/generate-sitemap.mjs` (postbuild step in `package.json`'s `build` script) writes
  `robots.txt`/`sitemap.xml` from a `SITE_URL` env var, paginating the backend's destination list
  for the sitemap's URLs — generated rather than static so neither can ship with a placeholder
  domain
- Infra: `infra/docker/frontend/Dockerfile` split into a shared `builder` stage plus two
  `--target`s — `frontend` (nginx, static assets + `robots.txt`/`sitemap.xml`, proxies everything
  else to `frontend-ssr`) and `frontend-ssr` (Node running `dist/frontend/server/server.mjs`,
  production-only `npm ci --omit=dev`); `frontend/nginx.conf`'s catch-all changed from
  `try_files ... /index.html` to `try_files $uri $uri/ @ssr` (proxy to the new service);
  `infra/docker-compose.prod.yml` gained a `frontend-ssr` service; `infra/build-and-push.ps1`
  builds and pushes both images
- **Real production-shaped bug found via live verification, not just build success**: the
  original design prerendered `destinations`/`destinations/:id` at build time (per the spec's
  "data changes rarely" reasoning). Prerendering all ~945 destinations fires that many data
  fetches essentially at once — traced into `@angular/build`'s own source
  (`utils/environment-options.js`/`utils/server-rendering/prerender.js`) to confirm this isn't
  configurable (fixed `~4`-worker pool, no pacing between requests) — which reliably hit the real
  MySwitzerland API's rate limit: a from-scratch build left 873 of 945 pages (92%) with the
  generic fallback title, no real content. First mitigation attempt was retry-with-backoff on
  429s; then the user raised a sharper question — prerendered pages are also permanently stale
  until the next full rebuild+deploy (no scheduled rebuild exists in this repo), so a
  MySwitzerland rename/removal would leave a stale or orphaned static page indexed indefinitely.
  Weighing that against `RenderMode.Server` (bounded 24h-Redis-cache freshness, self-healing
  per-request failures, real traffic naturally spread out instead of a synchronized build-time
  burst), the user chose to switch `destinations`/`destinations/:id` to `RenderMode.Server` and
  explicitly asked for the prerender-specific work to be cleaned up: removed
  `getPrerenderParams`/`getDestinationIds()` from `app.routes.server.ts` entirely, removed the
  429 retry/backoff interceptor logic (no longer needed once requests aren't a build-time burst),
  renamed `PRERENDER_API_URL`/`PRERENDER_HITS_PER_PAGE` → `SSR_API_URL`/`SITEMAP_HITS_PER_PAGE`
  everywhere (interceptor, sitemap script, Dockerfile, `build-and-push.ps1`) since the var is no
  longer prerender-specific. Home stays `RenderMode.Prerender` (single page, low fetch volume)
- **Second real bug found via live verification**: testing the switch to `RenderMode.Server`
  locally (`node dist/frontend/server/server.mjs` against the real running local backend)
  initially still returned the generic fallback title — root cause was `@angular/ssr`'s SSR
  host-check (`angular.json`'s `security.allowedHosts`, defaulting to `[]` from the `ng add`
  scaffold) rejecting every request's `Host` header and silently falling back to CSR (still a
  `200`, no error surfaced anywhere) rather than throwing. Fixed via the runtime-read
  `NG_ALLOWED_HOSTS` env var (`@angular/ssr/node`'s `getAllowedHostsFromEnv`, comma-separated,
  read fresh per request rather than baked in at build time) — wired as a new required var in
  `infra/docker-compose.prod.yml`'s `frontend-ssr` service (substituted from `infra/.env.prod`)
  and documented in `infra/.env.prod.example`. Would have silently broken SSR for every real
  visit in production with no obvious symptom if not caught here
- Verified live end-to-end after both fixes: started the real SSR server locally and curled a
  real destination page — correct title/description/canonical/`og:image`, all sourced from the
  live backend; spot-checked `destinations` (list), `explore-trips`, and `trip-planner`
  (`RenderMode.Client`, confirmed still 200s with the CSR shell)
- **Noindex-on-fetch-failure fallback**: `shell/destinations-layout/destinations-layout.ts`'s
  `ngOnInit` subscribe had no error handler — beyond the SEO gap (a failed fetch left whatever
  title was already showing, `200` status, no `noindex`, looking like a normal indexable page to
  a crawler unlucky enough to hit a transient failure), this was a real, independent reliability
  bug: an uncaught RxJS error terminates the *entire* subscription permanently, not just that one
  emission, so one failed destination fetch would silently break every subsequent route-param or
  language change for that component instance. Fixed with `catchError` nested inside the
  innermost `switchMap` (converts the error to a `null` emission instead of letting it propagate
  and kill the subscription) — on failure: clears the stale `destination` signal, closes the
  `destination-detail` drawer, calls `seo.set({ ..., noindex: true })` with a new
  `destinations.detail.loadError` i18n key (en/de/fr/it) as both title and description, and shows
  a toast via the existing `Toast` service. Verified live: an invalid destination id returns
  `200` with `noindex, nofollow` and the fallback title/description; a valid destination
  requested immediately after on the same running server still renders correctly
- User manually edited `frontend/src/index.html`'s static `<title>`/`<meta name="description">`
  (added a `keywords` tag too, initially) — reviewed and iterated together: title changed from
  the bare `ActivSwitzerland` fallback to `ActivSwitzerland - Plan Your Swiss Adventure`;
  description trimmed from ~690 characters (Google truncates/ignores past ~155-160) to ~155;
  `keywords` tag removed entirely (ignored by Google/Bing for ranking since ~2009, and the
  initial draft had two typos). This static tag is a last-resort fallback only — `SeoService`
  overwrites it per-route for every real render — so its practical reach is narrower than a
  typical "site description," but it's what a genuinely-unrendered state (or a CSR-only route
  before hydration) would show
- Verified throughout via `ng build`/`npm run build` (full production build including SSR
  bundle + sitemap generation) after every change, plus the live-server `curl` checks described
  above; **not yet deployed/tested against the real Docker/NAS production environment** — only
  local `ng build` output and a locally-run `node dist/frontend/server/server.mjs` against the
  real local backend were verified
- Not yet committed

### 2026-07-30 — Trip Planner Summary Inline Rail Connections Implemented

- Branch: `feature/trip-planner-summary-connections`; specced in
  `context/features/trip-planner-summary-connections-spec.md`
- `step4-summary.ts`: `visibleStops` (filtered to `days > 0`) replaced with `timelineStops`
  (all stops, unfiltered — 0-day pass-throughs now render as a slim card since `hasActivities()`
  is naturally false for them); new `legFor()`/`openConnection()`; `showMap()` gained a
  `type()==='rail' && !routeComplete()` gate showing `toast.warn(...)` instead of silently
  proceeding; `fixConnection()` removed (superseded by `openConnection()`); new `formatTime()`
  helper (mirrors `ConnectionLegPicker`'s) for the inline connection item's departure/arrival times
- `step4-summary.html`: main `@for` now iterates `timelineStops()`; a new `.s4-conn-item` button
  renders between every consecutive stop pair (rail trips only) via `@let leg = legFor(...)`,
  showing resolved/skipped/needed state and opening the connections drawer on click; old
  bottom-of-page unresolved-leg banner deleted
- `connections-drawer.ts`: new `isFocused(fromStopId, toStopId)` reads
  `drawerSvc.getPayload<{ focusLeg }>('connections')` and is passed to each
  `ConnectionLegPicker` as `[autoExpand]`; `connections-drawer.html` updated to pass it
- `connection-leg-picker.ts`: new `@Input() autoExpand`, implements `OnChanges` — `ngOnChanges`
  sets the `expanded` signal from `autoExpand` on every change (not just a one-shot `ngOnInit`
  read), so re-opening the drawer for a different leg correctly re-focuses regardless of whether
  PrimeNG reuses or recreates the drawer's content between opens (the spec's flagged open question
  — resolved by making the behavior reactive rather than depending on that lifecycle detail)
- i18n: new `trip.planner.step4.mapRequiresConnections` across en/de/fr/it; removed the now-dead
  `step4.connectionNeeded`/`step4.fixConnection` keys (connection-item state labels reuse the
  existing generic `trip.planner.step2.connectionPicked`/`connectionSkipped`/`connectionNeeded`
  keys instead, per the spec)
- Verified via `tsc --noEmit` (clean) before handing off for a live browser check
- UAT fixes in the same branch, found via the user checking live in the browser:
  - Real bug: `.s4-conn-item` had `width: 100%` plus a `margin-left: 0.7rem` indent (to sit under
    the stop-index circle), which pushed its right edge past the container — "Connection needed"
    ran off-screen. Fixed with `width: calc(100% - 0.7rem)` + `box-sizing: border-box`
  - Toast position changed app-wide from `top-center` to `center` (confirmed via AskUserQuestion
    that this should apply to all toasts, not just the new map-gating warning, since PrimeNG's
    `p-toast` position is a single global setting shared by every `Toast` service call in this app)
  - New `.toast-warn` class (`styles.css`) — `#dbeafe` background / `#0f3a68` text — replacing the
    default yellow `p-toast` warn styling for the map-gating toast specifically (existing
    `.toast-success`/`.toast-error` classes were the precedent for this per-severity override
    pattern)
- Feature marked complete

### 2026-07-30 — Trip Planner Summary Inline Rail Connections Specced

- User flagged that rail-connection setup (Step 2's "Train Connections" drawer) is easy to miss on
  mobile (below a scroll) and is what makes the Summary map preview meaningful — unresolved legs
  today just draw a straight line between stops in `buildRailRoute()`
- Presented two options: (1) force-resolve every leg on Step 2 before Step 3, removing "Skip for
  now"; (2) leave Step 2 unchanged, show every leg inline in Summary's timeline (resolved/skipped/
  needed, clickable to open the connection drawer), and gate the Map View toggle on all legs being
  genuinely resolved with a warning toast. User chose option 2
- Investigated `step4-summary.ts/html/css`, `connections-drawer.ts/html`, `connection-leg-picker.ts`,
  and `TripPlannerService`'s `legPairs`/`getConnectionLeg`/`setConnectionLeg`/`skipConnectionLeg` —
  confirmed `routeComplete()` already treats a skipped leg as unresolved (only `.connection`
  presence counts), so it can drive the map gate as-is; confirmed `Drawer.open(key, payload?)`/
  `getPayload<T>(key)` already supports passing which leg to auto-expand
  Confirmed via `AskUserQuestion`: rail trips can have 0-day "pass-through" stops, which Summary's
  timeline currently hides entirely (`visibleStops()` filters to `days > 0`) — since a leg exists
  between every literally-consecutive stop pair, a hidden 0-day stop would leave a leg with nowhere
  to attach. User chose to show a slim marker card for 0-day stops rather than combining their two
  legs into one item; this falls out for free by iterating `trip().stops` directly instead of
  `visibleStops()` (a 0-day stop naturally has no assignable day, so its activities section is
  already empty — no new markup path needed)
- Scoped: new inline `.s4-conn-item` (resolved/skipped/needed states, reusing existing
  `trip.planner.step2.connectionPicked`/`connectionSkipped`/`connectionNeeded` i18n keys) between
  every stop card for rail trips, replacing the old bottom-of-page unresolved-leg banner; clicking
  one opens the `'connections'` drawer with a `{ focusLeg }` payload that `ConnectionsDrawer` passes
  through as a new `autoExpand` input on the specific `ConnectionLegPicker`; `showMap()` gains a
  `type()==='rail' && !routeComplete()` gate with `toast.warn('trip.planner.step4.
  mapRequiresConnections')` (new i18n key, only new one needed) instead of silently disabling the
  Map View button
- Created `context/features/trip-planner-summary-connections-spec.md`; no feature branch created
  yet. Flagged one thing needing live verification during implementation: whether PrimeNG's
  `p-drawer` destroys/recreates `ConnectionsDrawer`'s content on each open (determines whether
  `autoExpand` needs a one-shot `ngOnInit` read or a reactive `effect()`)

### 2026-07-30 — Trip Planner Stop Search Language/TopographicPlace/Mode Icons marked Completed

- Status field above set to `Completed` following the live-verified implementation on
  `feature/trip-planner-stop-modes` (see the Implemented entry directly below)

### 2026-07-30 — Trip Planner Stop Search Language/TopographicPlace/Mode Icons Implemented

- Branch: `feature/trip-planner-stop-modes`; specced in `context/features/trip-planner-stop-modes-spec.md`
- `backend/src/utils/ojp.js`: `OJP_PLACE_TYPE.address` changed `'address'`→`'topographicPlace'`;
  `buildLocationInformationRequest` gained a third `lang` param (whitelisted against
  `en`/`de`/`fr`/`it`, inserted as `<Language>` between `<Type>`/`<NumberOfResults>`); `isArray`
  extended to force-array `Mode` (a stop with only one `Mode` would otherwise parse as a bare
  object); `mapPlace` reworked around a shared `textOf()` helper and new `extractModes()`
  (dedupes+orders `PtMode` values against a fixed `PT_MODE_ORDER` allowlist), gained a
  `TopographicPlace` branch (name from `TopographicPlaceName`, `id` from `TopographicPlaceCode`),
  kept the `Address` branch as a defensive fallback; `StopPlace` branch now reads
  `StopPlaceName` instead of the generic `Name`, plus a new `modes` field
- `backend/src/controllers/transport.js`: `getLocations` passes `req.query.lang` through as the
  new third arg — the only controller change needed
- Frontend: `LocationResult`/`LocationSearchResult` (`transport.ts`) both gained `type`/`modes`
  fields (`LocationSearchResult` didn't carry `type` at all before — no caller needed per-result
  rendering differences until now); `searchLocations()` injects `LangService` and sends `lang`;
  new `shared/utils/transport-mode-icons.ts` (`MODE_ICON` table + `resultIcons()`) is the single
  source of truth both `location-search-sheet.html` (mobile) and all four `p-autoComplete` item
  templates in `step2-itinerary.html` (desktop — none had a custom item template before this
  feature) render icons from
- Live-testing round (isolated local backend, `NODE_ENV=test` port 3099, separate from the user's
  Docker dev stack) surfaced three real findings the spec's "not yet verified" section had
  flagged, all resolved before merge:
  - `topographicPlace` behaves as cleanly as `address` did — a plain town-name query returns one
    clean result, not a flood of nested regions
  - `Restrictions/Language` does **not** appear to change returned name text — cycled a query
    through all four languages (including searching the German exonym `Genf` while requesting
    `lang=fr`) and always got back whichever alias the query text itself matched, never a
    translation. Same "soft hint, not a hard rule" behavior `NumberOfResults` showed in the
    original OJP feature. Left in the request anyway (harmless, schema-legal) but not relied on
  - Real bug found via the Zermatt live example: the cable-car `PtMode` wire value is `telecabin`,
    not `telecabine` as originally spec'd (an unverified guess) — surfaced as `Zermatt GGB`/
    `Zermatt Schwarzsee` both coming back with `modes: []` under the wrong spelling. User also
    clarified there's no separate `funicular` PtMode value; rack railways and aerial cabins both
    use `telecabin`. Since FontAwesome has no dedicated telecabin/funicular icon, `telecabin` maps
    to `fa-train-subway` per explicit user choice (not `fa-cable-car`, which stays reserved for the
    distinct `cableway` PtMode)
- Verified via `node --check` on both backend files, `tsc --noEmit`/`ng build --configuration
  production` (both clean, only pre-existing bundle-size/CommonJS warnings), and the live-testing
  round above; not yet exercised in a real browser session (no browser-automation tool available)
- Feature marked complete

### 2026-07-30 — Trip Planner Stop Search Language/TopographicPlace/Mode Icons Specced

- Follow-on to the OJP Location Search feature below, prompted by user questions about what
  `Restrictions/Type` values OJP 2.0 supports and whether a response language can be requested
- Researched live against the OJP 2.0 XSD (`OJP_Locations.xsd`/`OJP_PlaceSupport.xsd` on
  `github.com/VDVde/OJP`) rather than relying on the (previously found to be unreliable/OJP-1.0)
  cookbook docs: confirmed `Restrictions/Language` (`xs:language`, ordered `Type`→`Language`→
  `NumberOfResults`) and `PlaceTypeEnumeration`'s six values (`stop`/`address`/`poi`/`coord`
  [deprecated]/`location`/`topographicPlace`), plus `TopographicPlaceStructure`'s
  `TopographicPlaceName`/`TopographicPlaceCode` fields and `PlaceStructure`'s repeatable
  `Mode`/`PtMode` element (the last confirmed live by the user via a real Geneva `StopPlace`
  response with 5 `Mode` entries across 2 distinct `PtMode` values)
- Scoped three changes: (1) send the app's `LangService.current` selection as OJP's
  `Restrictions/Language`; (2) road trips restrict on `topographicPlace` instead of `address`
  (display name switches to the type-specific `TopographicPlaceName`/`StopPlaceName` fields
  instead of the generic `Place/Name` used today); (3) rail results show deduped mode icons
  (bus/trolleybus/rail/tram/metro/water/telecabine/cableway/air, fixed render order, unrecognized
  values silently dropped) read from `Place/Mode[]/PtMode`, road results get a single static
  `fa-location-dot` instead since `TopographicPlace`/`Address` results carry no `Mode` data
- Frontend impact wider than the original OJP feature: `LocationSearchResult` needs new
  `type`/`modes` fields (didn't carry `type` at all before, since callers never needed to render
  per-result differences), and both `location-search-sheet.html` (mobile) and all four
  `p-autoComplete`s in `step2-itinerary.html` (desktop, none have a custom item template today)
  need icon rendering added
- Created `context/features/trip-planner-stop-modes-spec.md`; no feature branch created yet — user
  hasn't confirmed whether to branch now or review the spec first. Several items flagged as
  needing a live-verify pass before finalizing (matching the original OJP feature's own experience
  of docs not matching live behavior): whether `topographicPlace` filters as cleanly as `address`
  did, whether `Language` actually changes response text or is a soft hint like `NumberOfResults`
  turned out to be, and the exact wire spelling of the cable-car `PtMode` value

### 2026-07-29 — OJP Location Search Specced

- Brainstormed two trip-planner pain points; this spec covers item 1 only (item 2 — mobile UX for the stop dropdowns while scrolled — deferred to a later phase per user request)
- Investigated the current `/locations` proxy (`backend/src/controllers/transport.js`, `frontend/src/app/shared/services/transport.ts`) and confirmed the reported bug's likely cause: transport.opendata.ch is a thin wrapper around search.ch's geodata, and its `type` filter isn't reliably enforced upstream
- User was already evaluating opentransportdata.swiss's OJP (Open Journey Planner) API and confirmed they hold an API key; researched OJP 2.0 live (endpoint, auth headers, `OJPLocationInformationRequest`/`OJPLocationInformationDelivery` element structure) via the VDV OJP 2.0 schema docs and the opentransportdata.swiss cookbook rather than relying on training-data knowledge, since the docs turned out not fully authoritative on wire-exact element names
- Scoped as backend-only: OJP's XML response gets mapped into the exact same `LocationsResponse` shape the frontend already consumes, so `TransportService`/`Step2Itinerary` need no changes; rail connection-building (`getConnections`/`getConnectionJourneys`) and road routing (OSRM) explicitly deferred to a future Phase 2, since OJP's `TripRequest` leg model doesn't map onto the existing HAFAS `sections`/`passList` parsing
- Created `context/features/ojp-location-search-spec.md`; no feature branch created yet — user wants to review the spec first. While reviewing, user added `OPENTRANSPORTDATA_ENDPOINT`/`TOKEN` directly to `backend/config/.env` and confirmed `https://api.opentransportdata.swiss/ojp20` is the correct OJP endpoint; spec updated to reference these actual env var names instead of the originally-proposed `OJP_ENDPOINT`/`OJP_KEY`

### 2026-07-29 — OJP Location Search Implemented

- Branch: `feature/ojp-location-search`; specced in `context/features/ojp-location-search-spec.md`
- Per the spec's own "verify live before writing the parser" step: built a real request against `https://api.opentransportdata.swiss/ojp20` using the docs found during spec research (OJP 1.0 cookbook pages, since the "2.0" URLs 404'd) — got a generic 400 "error occurred while deserializing input data" from every variant tried (different `Content-Type`s, `User-Agent`, etc.), because those docs describe OJP **1.0**'s request shape, which the real v2.0 endpoint rejects outright. The user then supplied a real working `curl` example from opentransportdata.swiss's own API Explorer, which turned out to have namespace prefixes **inverted** from every doc page found by search: v2.0 defaults to the `vdv.de/ojp` namespace (OJP elements unprefixed) and prefixes SIRI elements with `siri:` — the reverse of OJP 1.0 — and uses `<Name>` for the search text, not `<LocationName>`. Confirmed working live for both `type=station` and `type=address`, including that `Restrictions/Type` genuinely separates `StopPlace`-only from `Address`-only results (the exact bug this feature fixes) and that `NumberOfResults` is only a soft hint (asked for 3-5, got 6-8 back), so the mapper truncates client-side instead
- New `backend/src/utils/ojp.js`: `buildLocationInformationRequest(query, type)` (XML-escapes the query, maps `station`→`stop`/`address`→`address` for OJP's `Restrictions/Type`) and `parseLocationInformationResponse(xml, type)` (parses via new `fast-xml-parser` dependency, re-filters every result against the requested type defensively, hard-caps at 8, maps `StopPlace`/`Address` results into the pre-existing `{ id, name, coordinate: {x, y}, type }` shape)
- `backend/src/controllers/transport.js`: `getLocations` switched from an axios `GET` against `TRP_ENDPOINT` (transport.opendata.ch) to an axios `POST` against `OPENTRANSPORTDATA_ENDPOINT` with a Bearer token, same response envelope and error handling as before; `getConnections`/`getConnectionJourneys` untouched (still transport.opendata.ch, per the spec's Phase 2 deferral)
- `infra/.env.prod.example` gained `OPENTRANSPORTDATA_ENDPOINT`/`TOKEN` under a new `# opentransportdata.swiss` block
- No frontend changes, as scoped — `TransportService.searchLocations()` and `Step2Itinerary` consume the identical response shape
- Verified via `node --check` on both backend files, and live end-to-end testing: started an isolated local backend instance (`NODE_ENV=test`, no DB/Redis, separate port from the user's running Docker dev stack to avoid any risk of repeating the earlier cache-pollution incident from the Image Copyright Compliance feature) and `curl`'d `/api/v1/transport/locations` directly for station queries, address queries, a no-match query, and a query containing `&`/apostrophes (to confirm XML escaping) — all returned correctly typed, correctly shaped results with no server errors
- Spec updated post-implementation to replace its original (doc-sourced, partly wrong) request/response XML with the real verified wire format
- Real bug found via UAT: the running Docker `backend` container (`activswitzerland_backend`, port 3000) reads its env from `infra/.env`, not `backend/config/.env` — `OPENTRANSPORTDATA_ENDPOINT`/`TOKEN` had only been added to the latter, so the containerized backend's `getLocations` threw `TypeError: Invalid URL` (axios called with an `undefined` url) the moment the frontend hit it. Fixed by adding both vars to `infra/.env` as well; user rebuilt/recreated the container themselves and confirmed the stop-picker works for both road and rail trips
- Feature marked complete
- `feature/ojp-location-search` committed, merged into `main` (`--no-ff`, no `Co-Authored-By` trailer per explicit user instruction), and deleted; `main` pushed to `origin/main`

### 2026-07-29 — Trip Planner Mobile Stop Picker Specced

- Item 2 from the same trip-planner brainstorm that produced the OJP Location Search spec above — the mobile UX pain point deferred at the time
- Confirmed via a full-frontend grep that this codebase has no `BreakpointObserver`/`matchMedia` usage anywhere; every existing responsive split is plain CSS `@media (max-width: ...)`, so the design follows that convention (two markup blocks per field, CSS-toggled) rather than introducing JS breakpoint detection
- Deliberately designed around a specific piece of prior history: the Trip Planner Page Redesign (2026-07-28 entry above) already tried `appendTo="body"`/`forceSelection` on these same four `p-autoComplete` fields, hit a real focus-steal bug, and reverted per user request. This spec avoids repeating that by never touching PrimeNG's `AutoComplete` overlay internals for the mobile path — it swaps in a completely separate custom-built full-screen sheet component instead
- Investigated the existing `ConnectionLegPicker`/`ConnectionsDrawer`/`Drawer` service split to confirm the new sheet should be a plain local component (like `ConnectionLegPicker`), not a new `DrawerKey` — it's never linked to from outside `Step2Itinerary`, so it doesn't need router-back-nav wiring
- Created `context/features/trip-planner-mobile-stop-picker-spec.md`, committed directly onto `feature/ojp-location-search` (as a docs-only commit) before that branch was merged to `main`; no dedicated feature branch of its own yet — no implementation

### 2026-07-29 — Trip Planner Mobile Stop Picker Implemented

- Branch: `feature/trip-planner-mobile-stop-picker`; specced in `context/features/trip-planner-mobile-stop-picker-spec.md`
- New `features/trip-planner/step2-itinerary/location-search-sheet/` (`LocationSearchSheet`): self-contained full-screen search component — own `query`/`results`/`loading` signals, a `Subject`+`debounceTime(300)`+`distinctUntilChanged`+`switchMap` pipeline calling `TransportService.searchLocations()` directly (3-char minimum, same gate as desktop), `ngAfterViewInit` focuses the input via `ViewChild` (not relying solely on the native `autofocus` attribute, which is unreliable for dynamically-inserted elements); emits `selected`/`closed`, doesn't close itself — the parent owns closing
- `step2-itinerary.ts`: new `MobilePickerTarget` type (`'departure' | 'destination' | 'add' | { via: string }`), `mobilePickerTarget` signal, `mobilePickerInitialValue` computed, `openMobilePicker()`/`closeMobilePicker()`, and `onMobilePicked()` — which routes the sheet's pick back through the existing `applyDeparture`/`applyDestination`/`applyVia`/`applyAddStop` private methods unchanged, so no apply logic was duplicated
- `step2-itinerary.html`: each of the four field slots (departure, each via stop, destination, add-stop) gained a sibling mobile-only trigger button (`.s2-mobile-field` / `.s2-add-btn--mobile`) alongside the existing `p-autoComplete` (now tagged `.s2-input--desktop`); the sheet itself is mounted once, gated on `@if (mobilePickerTarget())`. Mobile's add-stop button calls `openMobilePicker('add')` directly, skipping desktop's `addingStop`-gated inline-field/Cancel-button flow entirely, since closing the sheet without picking is already equivalent to Cancel
- `step2-itinerary.css`: new `.s2-mobile-field`/`.s2-mobile-clear` styling (hand-matched to the app's existing input conventions, since PrimeNG's own autocomplete styling isn't captured in this component's stylesheet to copy from) plus one consolidated `@media (max-width: 767px)` block at the end of the file toggling `.s2-input--desktop`/`.s2-add-btn--desktop`/`.s2-add-active--desktop` off and `.s2-mobile-field`/`.s2-add-btn--mobile` on — same 767px breakpoint `drawer-host.css` already uses, no `BreakpointObserver`/JS detection introduced
- i18n: `trip.planner.step2.searchTitle`/`searching`/`noResults`/`clearSelection` added across en/de/fr/it; `trip.planner.step2.stop` (placeholder) and the top-level `trip.planner.back`/`trip.planner.removeStop` keys reused as-is, no duplicates
- Verified via `tsc --noEmit` and `ng build --configuration production` (both clean, only the pre-existing bundle-size/CommonJS warnings) and JSON-validated all four locale files; an IDE diagnostic flagged the new component as an unknown element immediately after the files were created, but that was a stale Angular Language Service snapshot — the real compiler passed clean once checked directly
- Not yet exercised in a real browser/mobile viewport — no browser-automation tool available in this environment; flagged as an open item before merging, same as the OJP feature's own gap that the user closed by testing directly
- UAT fixes in the same branch, found via the user testing live on their own device (the only way this component could actually be exercised, given no browser-automation tool in this environment):
  - `.lss-input-row` top padding increased `0.75rem` → `1.25rem` for more breathing room below the header
  - Real bug: the header bar (back control + "Search location" title) was entirely invisible on the user's device, even though the input/results below it rendered fine. Two blind guesses first (assuming a FontAwesome icon-loading issue, then a discoverability issue) didn't fix it; asking the user what they actually saw ("whole header bar is missing") plus their own hunch ("possibly hidden under header-nav") pointed at the real cause — root-caused to `.lss-overlay`'s `position: fixed` being nested inside the scrollable Step 2 card list, which item 2 exists specifically to fix by opening while already scrolled down; some combination of that ancestor chain was trapping the fixed positioning/stacking context rather than letting it anchor to the true viewport. Fixed by having `LocationSearchSheet` manually re-parent its own host element onto `document.body` via `Renderer2` in `ngOnInit` (removed again in a new `ngOnDestroy`, since Angular's own cleanup tracks the original logical parent) — a manual portal, sidestepping the whole class of ancestor stacking/scroll issues rather than chasing the exact CSS property responsible
  - Back button iterated twice on user feedback: FontAwesome icon-only → icon replaced with a plain-text "‹ Back" (in case the FontAwesome kit script hadn't loaded) → once the real header-visibility bug above was fixed and the icon was confirmed to render fine, reverted back to the original icon-only FontAwesome chevron per user request
- Feature marked complete

### 2026-07-29 — Image Copyright Compliance Implemented

- Branch: `feature/image-copyright-compliance`; specced in `context/features/image-copyright-compliance-spec.md`
- Backend `myswitzerland.js`: hardcoded `expand=true` on all 7 attraction/destination MySwitzerland queries, dropping the `req.query.expand` passthrough entirely (`getDestination` gained `expand=true` for the first time, though testing showed it made no difference to that endpoint's output); new `hasNamedCopyright`/`stripNonCompliantImages`/`stripNonCompliantImagesFromResponse` helpers (alongside the existing `hasValidGeo`/`stripInvalidGeo`) filter every response's `image[]` down to entries with a non-empty `copyrightHolder`, handling both list (array) and single-record (object) response shapes
- New shared `models/mys-image.ts` (`MysImage`) replaces `DestinationImage` and attractions' bare `{url: string}[]` image type; `Attraction`/`Destination` both use it
- Frontend services: `AttractionsService.getAttractions()`/`searchAttractions()` and `DestinationsService.getDestinations()`/`searchDestinations()` hardcode `expand=true`, dropping the now-pointless `expand` param from their signatures; also removed `getAttractionsNearby()`/`searchAttractionsNearby()` (dead code, never called) and the unused `top` param on `searchAttractions()` (backend never read it)
- List cards (destinations + attractions, 6 templates) switched from `.photo` to `image?.[0]?.url`, falling back to `no_image.png` — destinations didn't have this fallback at all before this feature
- Detail pages (`attraction-detail`/`destination-detail`): removed the `.photo` fallback branch entirely — no compliant image means no image section renders at all; galleria's main image gained a `© {{img.publisher}}` caption in a light-gray bar. Originally built against `img.name`, corrected mid-implementation per user feedback: `name` is often just a raw filename, `publisher` is the actual credited rights holder (consistently "Switzerland Tourism" in sampled data) and was the field actually intended
- Real bug found while verifying live (not a code bug): a Redis cache key collision with a stale Docker-hosted backend instance (`activswitzerland_backend`, sharing the same Redis container as this session's local test server) made the compliance filter look broken during testing. Root-caused via `docker ps`/`redis-cli KEYS`; the specific cache keys poisoned during testing were deleted, the user's own Docker dev stack was left untouched
- Verified via `tsc --noEmit`, `ng build --configuration production` (clean, only pre-existing bundle-size/CommonJS warnings), `node --check` on the backend controller, and live end-to-end testing against the real MySwitzerland API confirming every returned image has a non-empty `copyrightHolder`
- Feature marked complete

### 2026-07-29 — Image Copyright Compliance Specced

- Investigated a user question about whether MySwitzerland's attractions/destinations queries return image copyright data — found `expand` was `false`/omitted on every list query, so only the bare `photo` string (no attribution) was ever available; single-record endpoints already return full `image[]` data regardless of `expand`
- Live-tested the MySwitzerland API directly (list + single-record, attractions + destinations) to confirm the scope of the compliance gap: 46% of sampled images (98/213) have no `copyrightHolder` field
- Confirmed compliance rule with the user: an image is displayable if `copyrightHolder` is present and non-empty, regardless of string content; filtering happens server-side so non-compliant images never reach the frontend
- Scoped three changes: hardcode `expand=true` everywhere + server-side compliant-image filtering; `no_image.png` fallback on list cards (destinations didn't have this at all yet, attractions got it in a prior session); detail pages drop the `.photo` fallback entirely (no compliant image = no image section) and gain a `© {{image.name}}` galleria caption
- Created `context/features/image-copyright-compliance-spec.md`; no feature branch created yet

### 2026-07-28 — Trip Planner Page Redesign Implemented

- Branch: `feature/trip-planner-page-redesign`; specced in `context/features/trip-planner-page-redesign-spec.md` (see the `2026-07-27` entry below for the spec decisions)
- `TripPlannerService` gained `wizardVisible`/`showWizard()`/`hideWizard()`, `prefillPayload`/`setPrefillPayload()`, hoisted `legPairs()` (deduped out of `step2-itinerary.ts` and `step4-summary.ts`), and `hasDraft()` (deduped out of the wizard shell, now shared by every step's "Start over" link)
- `'trip-planner'` removed from `DrawerKey`; `TripPlannerLayout` now renders `<app-trip-planner-wizard>` directly as page content instead of via `DrawerHost`'s `p-drawer` — `Drawer.isOpen/open/collapse('trip-planner')` calls across `trip-planner-layout.ts`, `drawer-host.ts` (7 back-nav handlers), `step4-summary.ts`, and `step5-save.ts` all rewired onto the new service signals; `drawer-host.ts`'s `onTripPlannerBack()` moved into the wizard itself as `goBack()` (later removed, see below)
- Real bug found via UAT: the map (`<app-map>`) was always mounted in `TripPlannerLayout`, with only its markers/route data hidden while the wizard showed — the real MapLibre basemap tiles could bleed through around the wizard panel on mobile. Fixed by gating the whole `<app-map>` (and its reopen buttons) behind `@if (!tripPlanner.wizardVisible())`, so the map isn't in the DOM at all while the wizard is up; simplified away the now-redundant `displayedTripRoute`/`displayedTripActivityMarkers`/`displayedTripStopPoints` wrapper computeds
- New `'connections'` `DrawerKey` + `features/trip-planner/connections-drawer/` hosts `ConnectionLegPicker` (unchanged component) out of Step 2's inline content; Step 2 gained a "Train Connections" button (rail trips only) with an unresolved-leg-count badge; Step 4's "Fix connection" opens the drawer directly instead of jumping to Step 2
- Step 1 "My Trip": Start Date / End Date wrapped in a new `.s1-date-row` flex container, side by side instead of stacked
- Real bug found via UAT: `footer-nav.html`'s trip-planner link (`[queryParams]="{ from: router.url }"` + default `routerLinkActive`) stopped highlighting once you were actually on `/trip-planner`, because PrimeNG/Angular's default `routerLinkActive` matching checks query params as a *subset* match (not ignored), and the link's own reactive `queryParams` binding becomes self-referential once on that route. Fixed with an explicit `[routerLinkActiveOptions]="{ paths: 'subset', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored' }"`
- `.tp-wizard-host`'s top offset tightened `4.5rem` → `3.5rem` (56px) to close the gap between the app header and the wizard's own header, per UAT feedback wanting more content real estate
- Step 2 itinerary fields (`p-autoComplete` for departure/via stops/destination/add-stop) UAT saga:
  1. First pass used PrimeNG's `[forceSelection]`/`[showClear]`/`appendTo="body"` to require picking a real suggestion and allow clearing it
  2. Real bug found via live Playwright reproduction against the user's own dev server (not just code reading — two earlier rounds of code-only fixes didn't resolve it): selecting an option in one field, then clicking into a different field, silently stole focus back to the first field ~7-20ms later, so keystrokes meant for the second field landed on the first instead. Root-caused to a genuine PrimeNG v21 `AutoComplete` behavior — `forceSelection` re-validates the typed text against cached suggestions on *every* internal `hide()` call, including the one right after a successful select elsewhere, and refocuses via a delayed `setTimeout`. Confirmed by monkey-patching `focus()`/`setTimeout` and capturing call stacks live in the browser
  3. Reverted all `forceSelection`/`showClear`/`appendTo`/`autofocus` bindings back to plain autocompletes per user request
  4. Reimplemented both requirements without PrimeNG's `forceSelection`: `[showClear]` + `(onClear)` restored on Departure/Destination/Via (removing a via's selection removes that stop's row, matching its existing header remove button) for the "clear a selection" ask; a manual `(onBlur)`/`(keydown.enter)` handler on all four fields (`commitTypedText()`) checks whether the typed text exactly matches a current suggestion (auto-applies it, as if clicked) or reverts the native input's displayed text back to the last real selection (or blanks it) — a pure display-layer correction, no PrimeNG internals involved, so the focus-steal bug can't recur
- Via stop's remove button icon changed `fa-light fa-xmark` → `fa-solid fa-trash`
- New shared `features/trip-planner/start-over-link/` component (reads `plannerSvc.hasDraft()`, triggers the same confirm-then-`reset()` flow); dropped into all 5 step templates directly above each one's own Back/Next (or Save) buttons, centered, per UAT feedback. Wizard shell's header simplified to just the step-indicator row — back chevron, step title, and the old inline "Start over" button all removed (`goBack()`/`Router`/`ActivatedRoute` also removed from the wizard component as now-unused); `.tpw-header` padding tightened `0.85rem 1rem 1.1rem` → `0.6rem 1rem` for more content room. Confirmed acceptable since the footer-nav/header-nav chrome (still visible now that the wizard is a normal page, not a drawer) already covers back-navigation
- New `trip.planner.cancel` i18n key added across en/de/fr/it; confirm dialog's reject button relabeled from "Back" to "Cancel"; accept button (`acceptButtonStyleClass: 'start-over-accept-btn'`) styled via a new global `styles.css` rule (`p-confirmDialog` defaults to `appendTo="body"`, same reason the Step 3 day-select dropdown needed a global rule rather than component-scoped CSS)
- Verified via `tsc --noEmit` and `ng build --configuration production` (clean) after every change in this session; UI verified live via Playwright against the user's own running dev server for the autocomplete focus-steal investigation specifically, otherwise verified by the user directly in-browser throughout
- Feature marked complete

### 2026-07-27 — Trip Planner Page Redesign Specced

- Prompted by live-screen review of the rebuilt Trip Planner (see the `2026-07-15`/`2026-07-16` Phase 1-4 entries below for the base rebuild this iterates on)
- Explored current architecture in depth: confirmed the wizard has no route of its own today (only rendered inside `DrawerHost`'s `'trip-planner'` `p-drawer`), and that PrimeNG drawers are `modal: true` by default — explains the dark scrim/flash the user was reacting to
- Asked user to choose between (a) the real fix — removing `trip-planner` from the generic drawer system and hosting the wizard as direct page content, rewiring Step 4's map-reveal mechanic onto a dedicated `TripPlannerService` signal — vs. (b) a lower-risk cosmetic fix (`[modal]="false"` + full width on the existing drawer). User chose (a)
- Confirmed via AskUserQuestion: the new "Train Connections" button/drawer on Step 2 only appears for Rail Journey trips, not Road Trip
- Created `context/features/trip-planner-page-redesign-spec.md`; no feature branch created yet — user wants to review the spec before branching/implementation starts

### 2026-07-26 — Mountain Bike Trails Implemented

- Branch: `feature/mountain-bike-trails`; specced in `context/features/mountain-bike-spec.md`
- Backend: `bikeRoutes.js` — `BIKE_LAYER` constant replaced with a `BIKE_LAYERS` map (`road` → `ch.astra.veloland`, `mountain` → `ch.astra.mountainbikeland`) + `resolveBikeType(req)` helper (defaults to `'road'`), used by both `getBikes` and `getBikeStages`; no changes needed to the shared `schweizMobilRoutes.js` utilities (layer-agnostic) or `cacheResponse()` (already keys on full query string, so `road`/`mountain` cache independently)
- `models/Trip.js`: `TripActivitySchema` gained `bikeType: enum['road','mountain']` (optional)
- Frontend: `trail-routes.ts` — `getRoutes`/`getRouteStages` gained an optional trailing `bikeType` param (new `BikeType` export), sent as a query param only when provided; `models/trip.ts` — `TripActivitySelection.bikeType?`
- `bike-markers.ts`: new `bikeType` signal (default `'road'`, reset alongside `radiusKm`/`selectedCategory` in `resetFiltersForDestination`), `setBikeType()`, and a `markerId(routeNumber)` helper producing `bike-{type}-{routeNumber}` — replaces the old `bike-{routeNumber}` id, which would have collided between the two independently-numbered networks
- `bikes-list.ts`: new `onBikeTypeChange()` (no-op if unchanged; else switches type, clears `selectedId`/`stageOverview`, refetches); `load()`/`onSeeAllStages()` pass the active `bikeType`; `toggleAdd()`/`addedRefIds` also match on `bikeType` so a same-numbered route in the other network doesn't show a false "Added" badge
- `bikes-list.html`/`.css`: new "Road trails"/"Mountain trails" tab row at the top of the drawer, styled like the homepage search box's tabs but fitted to the drawer panel (no floating-card chrome)
- `trip-planner-layout.ts`: `onActivityMarkerClick`'s bike branch passes `activity.bikeType ?? 'road'`, so saved-trip bike activities from before this feature still resolve correctly
- i18n: `bikes.tabs.road`/`bikes.tabs.mountain` added across en/de/fr/it
- Verified via `tsc --noEmit` and `ng build --configuration production` (both clean; only pre-existing bundle-size/CommonJS warnings unrelated to this change) and `node --check` on both modified backend files; UI not yet exercised in a live browser session
- Feature marked complete

### 2026-07-26 — Mountain Bike Trails Specced

- Investigated a user question ("does the bike API distinguish mountain bike vs. normal bike trails?") — found `bikeRoutes.js` only ever queries `ch.astra.veloland` (road/city cycling); mountain bike routes aren't fetched at all, so the distinction doesn't exist in the data yet
- Confirmed live via direct geo.admin.ch `identify` calls that `ch.astra.mountainbikeland` is a real, separate SchweizMobil layer with the same `chmobil_*` attribute schema as Veloland/Wanderland — no backend utility changes needed beyond parameterizing the `layer`
- Identified that route numbers aren't unique across the two networks, so marker ids/routeMap keys/saved-trip activity refs all need a `bikeType` tag, not just a new UI toggle
- Scoped as its own feature (not folded into the in-progress `app-fixes3` mobile-fixes branch) per user decision; `app-fixes3`'s WIP was committed first so it wasn't dragged onto the new branch
- Created `context/features/mountain-bike-spec.md` and `feature/mountain-bike-trails` branch (off `app-fixes3`); no implementation yet

### 2026-07-21 — Destination/Attraction Missing-Geo Crash Fixed

- Real bug found via user report: `destination-detail.ts` crashed (`Cannot read properties
  of undefined (reading 'latitude')`) for destinations MySwitzerland returns with no `geo`
  coordinates at all — the weather-fetch effect assumed `dest.geo.latitude` always exists
- `backend/src/controllers/myswitzerland.js`: new shared `hasValidGeo`/`stripInvalidGeo`
  helpers (NaN + non-zero check, mirrors the frontend's existing `hasValidGeo` in
  `attraction-markers.ts`) applied to all 6 list-returning endpoints
  (`getDestinations`, `getDestinationsByGeobBox`, `searchDestinations`, `getTopAttractions`,
  `getAttractions`, `searchAttractions`) — records with missing/placeholder (0,0)
  coordinates are filtered out of the response before it reaches the client. Single-record
  endpoints (`getDestination`/`getAttraction`) are untouched, since filtering doesn't apply
  when the client explicitly requested that exact id
- `destination-detail.ts/.html`: new `hasGeo` computed guards the weather-fetch effect,
  `openWeather()`, and `openHikes()`/`openBikeRides()` (which pass the destination's
  coordinates into a downstream radius search that would crash the same way); template
  hides the Hikes/Bike Rides cards, weather box, and nearby-attractions list entirely when
  geo is missing rather than rendering broken UI — Hotels stays visible since it doesn't
  depend on coordinates
- Verified via `tsc --noEmit` and `ng build` (both clean)

### 2026-07-21 — Homepage Search Implemented

- Branch: `feature/home-search`; specced in `context/features/home-search-spec.md`
- Backend: new `searchDestinations` handler in `myswitzerland.js` mirroring
  `searchAttractions` (destinations had no free-text `query` param before this), mounted at
  `GET /searchdestinations` with the same `cacheResponse()` middleware as every other route
- `DestinationsService.searchDestinations()` added, mirroring `AttractionsService.searchAttractions`
- `AttractionDetailPayload.source` gained a `'search'` value plus `searchQuery`/`searchTab`
  fields; `onDestinationBack()`/`onAttractionDetailBack()` in `drawer-host.ts` became
  origin-aware — a destination or attraction reached via search now returns to
  `/search?q=...&tab=...` on back instead of the destinations list/all-attractions, via a
  new `from`/`q`/`tab` query-param branch (same pattern as the existing
  `AttractionDetailPayload.source`/`ActivityPickerPayload.origin` mechanism)
- New `features/search/search-box/` — tabs (Places to visit/Things to do) + input + button,
  matching `context/screenshots/homepage_search.png` (journey/layout reference only, not an
  exact color spec, per the user); embedded on the homepage between hero and City Breaks,
  overlapping the hero's bottom edge via negative `margin-top`
- New `/search` route → `features/search/search-page/`, using PrimeNG's `p-tabs`/`p-tablist`/
  `p-tabpanels` with `[lazy]="true"` so only the active tab's result component ever mounts
  and fetches; a shared search input updates the URL (`?q=`/`?tab=`) on submit or tab switch
- New `features/search/destination-search-results/` and `attraction-search-results/` — each
  guards against refetching an already-searched query (per-tab, per-query caching); click-through
  to `/destinations/:id` (destinations) or the `attraction-detail` drawer directly (attractions)
- "Search" added to `menu-nav` and `footer-nav`; `footer-nav`'s `isFooterNavRoute` extended to
  show on `/search` too
- i18n: `nav.search`, `home.search.*` (tabs, placeholders, search button, back-to-search,
  load/no-results errors) added across en/de/fr/it
- Deviation from spec: the spec described one component serving both the homepage card and
  the `/search` page's header/control. Built instead as `SearchBox` (homepage-only,
  self-contained tab-toggle + input + button, navigates away on submit) plus a simpler input
  row directly in `SearchPage` paired with real PrimeNG tabs for results-switching — avoids
  either an awkward tabless `p-tabs` instance or two live tab UIs stacked on one page
- UAT fixes in the same branch: hero-overlap negative margin reduced by 40px (`-3rem/-4rem`
  → `-0.5rem/-1.5rem`) so the search card sits lower/less overlapping; search-box shadow
  softened (`0 10px 30px rgba(0,0,0,.18)` → `0 4px 16px rgba(0,0,0,.1)`) to match the app's
  subtler card-shadow scale; Nature Parks section (last on the homepage) gained
  `padding-bottom: 6rem` since the fixed 64px footer-nav was partially covering its content
- Verified via `tsc --noEmit` and `ng build` (both clean); UI not yet exercised in a live
  browser session (no browser-automation tool available in this environment)
- Feature marked complete

### 2026-07-21 — Homepage Search Specced

- Specced a homepage search section (between hero and City Breaks) letting users search
  destinations ("Places to visit") or attractions ("Things to do") via PrimeNG Tabs,
  submit-based (not type-ahead), with lazy per-tab fetch and per-(tab, query) caching so
  only the active tab's API call fires
- New dedicated `/search` route hosts the full results experience (not a drawer) —
  shareable/bookmarkable `?q=`/`?tab=` URL; destination results navigate to
  `/destinations/:id` (reusing the existing `destination-detail` drawer auto-open),
  attraction results open `attraction-detail` directly with a new `source: 'search'` value
- Confirmed decision: `destination-detail`'s back button (`onDestinationBack()` in
  `drawer-host.ts`) needs to become origin-aware — currently only knows how to return to
  the destinations list via a `category` query param; a `from`/`q`/`tab` query-param branch
  is needed so a destination reached via search returns to `/search` instead, following the
  same pattern already used by `AttractionDetailPayload.source`/`ActivityPickerPayload.origin`
- Backend needs a new `searchDestinations` handler/route mirroring `searchAttractions` —
  destinations currently have no free-text search parameter at all
- "Search" link to be added to `menu-nav`/`footer-nav`
- Created `context/features/home-search-spec.md`; no feature branch created yet

### 2026-07-19 — Hike/Bike Multi-Day Stages Implemented

- Branch: `feature/hike-bike-multi-day-stages`; specced in `context/features/hike-bike-multi-day-stages-spec.md`
- Backend: `schweizMobilRoutes.js` — existing radius search (`fetchSchweizMobilRoutes`) now captures `hasSegment`/`stageNumber`/per-stage `title` while grouping stage features; new `fetchRouteStages({ layer, routeNumber, lang })` does the two-call `find`-service fetch (attributes-only + geometry-only, merged by feature id, sorted by stage number, reprojected to WGS84) for the nationwide "see all stages" fetch; new `GET /api/v1/{hikes|bikes}/:routeNumber/stages` routes, cached via `cacheResponse()`
- Frontend: `TrailStage` gained `stageNumber`/`title`; `TrailRoute` gained `isMultiDay`/`totalStages`; new `TrailRoutesService.getRouteStages()`; `hikes-list`/`bikes-list` show a new badge row below the category/distance row (Stage N of Total / Stages N–M of Total / Single route, with `NoTotal` i18n fallback keys if the total-stage lookup fails) plus a "See all stages" link right-aligned via `justify-content: space-between`; new `stageOverview` signal on `HikeMarkersService`/`BikeMarkersService`; `map.ts` renders the nationwide stage line + numbered markers via a new `syncStageOverview()` (own source/layer ids, mirrors `syncTripRoute()`'s pattern); `destinations-layout` wires it up and hides the normal nearby-search markers while an overview is active
- i18n: `hikes.multiDay.*`/`bikes.multiDay.*` (`stage`, `stageNoTotal`, `stageRange`, `stageRangeNoTotal`, `seeAllStages`, `singleRoute`) added across en/de/fr/it
- Real bug found via UAT: after initial implementation, no route ever showed as multi-day — root cause was a stale Redis cache (`cacheResponse()`, 24h TTL keyed by request URL only, no version-busting) still serving pre-feature `/api/v1/hikes`/`/api/v1/bikes` responses with no `isMultiDay` field at all. Confirmed the backend logic itself was correct by querying the live geo.admin.ch API directly (bypassing the cache), then flushed the 16 stale `mys:/api/v1/hikes*`/`mys:/api/v1/bikes*` Redis keys
- Follow-up UAT fix: badge text changed to include the nationwide total ("Stage 9 of 20" / "Stages 9–10 of 20") — required a new best-effort, attributes-only (`returnGeometry=false`, no geometry payload) `fetchStageCount()` per multi-day route, fetched in parallel during the radius search and cached alongside it; "See all stages" link moved to the right edge of its row
- Real bug found via UAT: a route opened via its detail card (`hike-detail`/`bike-detail`, which drives its own independent `trailRoute`/`trailColor` map layer) kept rendering on the map even after returning to the list and viewing a different route's "see all stages" overview — `reopenHikes()`/`reopenBikes()` only reopened the list drawer, never closed the still-open (or collapsed) detail drawer underneath it. Fixed by having both reopen methods close the sibling detail drawer first (safe no-op if it isn't open), matching how the detail drawer's own back arrow already behaved
- Verified via `tsc --noEmit` and `ng build` (both clean); UI not yet exercised in a live browser session (no browser-automation tool available in this environment)
- Feature marked complete

### 2026-07-19 — Hike/Bike Multi-Day Stages Specced

- Specced multi-day stage badges ("Stage # of a multi-day route" / "Stages #–#" / "Single route") on hike/bike list cards, plus a "See all stages" map view drawing the full nationwide stage line + numbered markers, reusing the existing hikes/bikes reopen-button mechanism to return to the list
- Confirmed via direct API testing: `chmobil_has_segment` + the `"{routeNumber}.{stageNumber}"` feature id distinguish multi-day vs standalone routes; geo.admin.ch's `find` service (not the radius-bound `identify` used today) is required for a nationwide all-stages fetch, and needs two calls (`returnGeometry=false` for attributes, `=true` for geometry) merged by id
- Created `context/features/hike-bike-multi-day-stages-spec.md`; no feature branch created yet

### 2026-07-16 — Trip Planner Rebuild Phase 4 (Save Trip) Implemented

- Branch: `feature/trip-planner-save`; specced in `context/features/trip-planner-save-spec.md` (split out of `trip-planner-rebuild-spec.md`'s Phase 4 section, which was trimmed to a pointer)
- `backend/src/models/Trip.js` fully replaced (no migration) to mirror `models/trip.ts`'s `PlannedTrip` shape — `TripDateRangeSchema`, `TripStopSchema`, `TripSectionStopSchema`/`TripSectionJourneySchema`/`TripSectionSchema`, `TripConnectionSchema`, `TripConnectionLegSchema`, `TripActivitySchema` (day as `Mixed` — ISO date string or relative day number), top-level `TripSchema{user, name, type, dateMode, range, stops, connections, activities, routeCoordinates, createdAt}`; old documents (`stationId`/`attractionIds` shape) are orphaned, per the master spec's explicit no-migration decision
- `controllers/trips.js`: `createTrip` field list updated to `{ name, type, dateMode, range, stops, connections, activities, routeCoordinates }` (was `{ name, type, stops, attractionIds, routeCoordinates }`); `getTrips`/`updateTrip`/`deleteTrip` unchanged
- `TripPlannerService` gained a `loadedTripId` signal — set by `loadSavedTrip()` (captures `trip._id`, previously discarded), cleared by `reset()`/`setType()` — so Step 5 can tell whether the in-progress trip was reopened from Profile
- New `features/trip-planner/step5-save/` — trip name input pre-filled with a suggested name (`trip.planner.step5.suggestedRoad`/`suggestedRail`) or the existing name when editing a saved trip; plain type/duration/destinations/activities summary rows (small, deliberate duplication of Step 4's computeds rather than a shared abstraction for four one-line reads); Save Trip/Update Trip action, create vs. update decided by `plannerSvc.loadedTripId()`; anonymous users see `saveHint` text and a Save click opens the `'auth'` drawer instead of calling the API (stacks on top of `'trip-planner'`, no redirect needed — Save works normally once logged in); on success the returned `_id` is written back into `loadedTripId` (so a second Save updates instead of duplicating), the draft is cleared, a `savedSuccess` toast fires, and the trip-planner drawer auto-collapses to reveal the finished route on the map (reuses Step 4's existing map-reveal mechanism, no new plumbing); "Browse Saved Trips" links out to `/auth/profile` (no new browse UI — Profile's saved-trips grid already exists); wired into `trip-planner-wizard` as `@case (5)`, replacing the `@default` placeholder now that all 5 steps are covered
- `profile.ts`'s `viewTrip()` gained `this.tripPlannerSvc.step.set(4)` alongside the existing `loadSavedTrip(trip)` call, so reopening a saved trip lands on Summary instead of My Trip — no new "one-shot flag" needed since `step` was already a public writable signal
- i18n: `trip.planner.step5.*` added across en/de/fr/it; removed the now-unused `tripNamePlaceholder` (superseded by the pre-filled suggested name) and `trip.planner.comingSoon` (the wizard's placeholder case it backed no longer exists) keys
- UAT fix in the same branch: the save-confirmation and save-error toasts were unreadable — `Toast.success()`/`Toast.error()` were called with no `styleClass`, unlike `Auth`'s calls which already pass `'toast-success'`/`'toast-error'` to pick up `styles.css`'s custom-background rules; both now explicitly pass `'toast-error'` (red background) per direct user feedback after testing
- Verified via `tsc --noEmit` and `ng build` (both clean); UI not yet exercised in a live browser session
- Feature marked complete

### 2026-07-15 — Trip Planner Rebuild Phase 3 (Summary) Implemented

- Branch: `feature/trip-planner-summary`; specced in `context/features/trip-planner-summary-spec.md` (split out of `trip-planner-rebuild-spec.md`'s Phase 3 section, which was trimmed to a pointer)
- `shared/map/map.ts`: `syncTripRoute()`'s road branch replaced the old start/end icon scheme (green circle-dot / red location-dot) with every stop numbered 1..N, all sharing the existing navy numbered-circle style except the final stop (destination), which gets a distinct red — generalizes to any number of stops instead of a fixed start/end pair
- `trip-planner-layout.ts/html`: `tripAttractionMarkers` (Phase 1 scaffolding, attraction-only) renamed to `tripActivityMarkers` and widened to all three `ActivityKind`s with a per-kind icon/color (binoculars/navy, hiking/green, bicycle/orange); marker `id` switched from `a.refId` (collidable across kinds) to `a.id` (the selection's own unique uuid); `(markerClick)` bound on `<app-map>` (previously unbound) to a new `onActivityMarkerClick()` — looks up the full `TripActivitySelection` by marker id, re-fetches the source object (`AttractionsService.getAttraction()` by id for attractions; best-effort radius re-search + id match via `TrailRoutesService.getRoutes()` around the owning stop's coordinates for hikes/bikes, since there's no fetch-by-id for trail routes), and opens the matching detail drawer
- `attraction-detail.ts`/`hike-detail.ts`/`bike-detail.ts`: payloads gained a `'trip-summary'` source value (new union member on `AttractionDetailPayload.source`, new optional `source?` field on `HikeDetailPayload`/`BikeDetailPayload`, which previously had none); `drawer-host.ts`'s `onAttractionDetailBack()`/`onHikeDetailBack()`/`onBikeDetailBack()` each gained a `source === 'trip-summary'` branch that reopens `'trip-planner'` (un-collapsing the drawer back to Summary) instead of the normal list-drawer reopen, since a Summary map-marker click has no backing list drawer on the stack to return to
- New `features/trip-planner/step4-summary/` — stat tiles (destination/activity counts), road-or-rail + date-range badges, a Timeline/Map View toggle (Map View just calls `drawer.collapse('trip-planner')`, reusing the map-reveal mechanism already built into `trip-planner-layout`; no new toggle plumbing needed), one card per stop with `days > 0` showing its activities grouped by kind with an inline remove (×) (mirrors `step3-activities`), an informational "connection needed" banner per unresolved rail leg with a "Fix connection" action (`plannerSvc.step.set(2)` — Step 2 already renders every unresolved leg simultaneously, no per-leg state needed), and a "Route complete!" banner once every leg (rail) or the road trip itself is resolved; wired into `trip-planner-wizard` as `@case (4)`
- i18n: `trip.planner.step4.*` added across en/de/fr/it
- Confirmed via product decision during spec: activity thumbnails are icon-only (no photos) for all three kinds — no `TripActivitySelection` model changes needed
- Verified via `tsc --noEmit` and `ng build` (both clean); UI not yet exercised in a live browser session
- Feature marked complete

### 2026-07-15 — Trip Planner Rebuild Phase 2 (Activities) Implemented

- Branch: `feature/trip-planner-activities`; specced in `context/features/trip-planner-activities-spec.md` (split out of `trip-planner-rebuild-spec.md`'s Phase 2 section, which was trimmed to a pointer)
- New `models/geo-point.ts`: `GeoPoint{id,name,lat,lon}` + `ActivityPickerPayload{destination,mode?,stopId?}` — decouples `all-attractions`/`hikes-list`/`bikes-list` from requiring a full MySwitzerland catalogue `Destination`, since trip stops are free-text/address search results; `shared/utils/geo-location.ts` (`isDestination`/`locId`/`locLat`/`locLon`) normalizes reads across the two shapes. Both pickers already supported pure lat/lon radius search under the hood (`AttractionsService.getAttractionsNearby`, geo.admin.ch's `lat`/`lon`/`radius`) — no backend changes needed
- `all-attractions`/`hikes-list`/`bikes-list`: payload widened from a bare `Destination` to `ActivityPickerPayload`; added `mode`/`stopId`/`dayOptions`/`dayChoices` (translated "Day N" / "Day N - DD-MM-YYYY" labels) computeds; each card gains a day-select + Add/Added button in `mode: 'select'`; card-tap still opens the (read-only) detail drawer in select mode instead of collapsing to the map
- `attraction-detail`/`hike-detail`/`bike-detail` payloads gained `mode?`/`stopId?` so `drawer-host.ts`'s back-nav handlers can reconstruct the picker's payload; removed `AttractionDetailPayload.source`'s dead `'trip-planner'` arm (never had a caller) — select-mode detail views now back-nav to the originating list, not straight to the wizard
- `TripPlannerService` gained `addActivity`/`removeActivity`/`isActivityAdded`/`getActivitiesForStop`; `shared/utils/date-range.ts` gained `stopDayRanges`/`stopDayOptions`/`formatDdMmYyyy`/`dayChoiceLabelParams` (the former lifted out of `Step2Itinerary`'s local computed, now shared with Step 3)
- New `features/trip-planner/step3-activities/` — one card per stop with `days > 0`, four category rows (Places to Visit/Hikes/Bike Rides/Hotels-stub) opening the matching picker in select mode, plus an inline added-items list per stop with its own remove control; wired into `trip-planner-wizard` as `@case (3)`
- i18n: `trip.planner.step3.*` added across en/de/fr/it
- UAT fixes in the same branch:
  - Real bug: Step 2's "Next" button had been hardcoded `[disabled]="true"` with a "coming soon" hint ever since Phase 1 — never wired up once Step 3 actually existed. Wired to `canContinue()` + a new `next()` method
  - Real bug: the days-here `<input>` was bound to `stop.days` off `Step2Itinerary`'s local departure/via/destination draft signals, which `onDaysChange()` never updated (only `TripPlannerService` was updated) — the field silently reverted to its old value on the next render, and `syncStops()` (called on unrelated edits like reordering) would then clobber the service's correct value with the stale draft copy. Fixed by reading the live value via a new `daysFor(stop)` helper and having `syncStops()` preserve each stop's current live `days` instead of overwriting it
  - Real bug: `canContinue` never checked `allocationMessage()`, so Step 2 let you continue to Activities with an over/under-budget day allocation despite the warning banner showing. Added `allocationMessage() === null` to the gate
  - Day-select dropdown: PrimeNG's default overlay was rendering inside the scrolling card (pushing it up/clipping) — added `appendTo="body"`; since that portals the option list to `<body>`, outside any component's view, `panelStyleClass="day-select-panel"` + a global `styles.css` rule was needed to size its font (component-scoped `::ng-deep` can't reach a body-appended node — only the closed control's own label, which stays in-component, could be sized that way)
  - Footer Back/Next buttons switched from `grid-template-columns: auto 1fr` to `1fr 1fr` (equal width) on both `step2-itinerary` and `step3-activities`; Next-button labels changed from generic "Next" to bare step names ("Activities", "Summary" — matching Step 1's pre-existing "Continue to Itinerary" precedent, then simplified to drop "Continue to" except on Step 1 per follow-up feedback)
  - "Places to Visit" card height bumped 90px → 110px (description text was clipping at 3 lines)
  - Allocation warning banner moved from the top of the scrollable stop list to just above the footer, so it stays visible without scrolling on mobile
- Feature marked complete

### 2026-07-15 — Trip Planner Rebuild Phase 1 Implemented

- Branch: `feature/trip-planner-shell-itinerary`
- Deleted the old wizard (`trip-planner.ts/.html/.css`) and `things-to-do/*`, and the old body of `shared/services/trip-planner.ts`; removed `'things-to-do'` from `DrawerKey`/`AttractionDetailPayload.source` and its now-dead back-nav branch in `drawer-host.ts`
- `models/trip.ts` rewritten: `PlannedTrip{type,dateMode,range,stops,connections,activities,routeCoordinates,name}`; `TripStop{id,role,name,lat,lon,externalId,days}` — see below for why per-stop dates ended up as a plain day-count rather than an arrival/departure pair
- `TripPlannerService` rewritten around the new model — `setType`/`setDateMode`/`setOverallRange`/`setStops`/`updateStopDays`/`setConnectionLeg`/`skipConnectionLeg`/`reset`/`loadSavedTrip`; draft autosave switched from `localStorage` to `sessionStorage` (survives a reload, clears on tab close instead of lingering indefinitely); `reset()`/`setType()` now actually clear the draft (previously wiped the in-memory trip but left a stale copy in storage that would silently reappear)
- New `features/trip-planner/trip-planner-wizard/` shell (the `'trip-planner'` drawer's component) — step signal (1–5) + step indicator; "Start over" action in the header (confirm dialog) once a draft exists
- New `features/trip-planner/step1-my-trip/` — road/rail toggle, dates-vs-day-count toggle; past dates disabled (`min` = today); day count is inclusive so a 1-day trip (start date === end date) is valid
- New `features/trip-planner/step2-itinerary/` — departure/via/destination cards with CDK drag-drop reordering on via stops, free-text autocomplete via `transport.ts` `searchLocations()`, and a per-leg rail connection picker (`connection-leg-picker/`: search/pick/"Skip for now", never blocks the step)
- Per-stop date modeling went through two false starts before landing on the shipped design, driven by UAT:
  1. Arrival/departure per stop with auto-shift cascading on edit — reverted after a real bug surfaced (epoch-day numbers leaking into "day count" mode fields) and the cascade logic proved hard to reason about
  2. Locked (departure's arrival / destination's departure, mirrored from the trip's overall range) + editable fields with equality-chain validation between neighbors — worked but validation initially checked "on or after" instead of exact equality and let one bad stop cascade false positives onto everything after it
  3. Shipped design: each stop just holds `days: number` (0 allowed — same-day pass-throughs, or a non-day departure point like "home"); validation is one arithmetic check, `sum(stop.days) === trip's total days`; a "Day N" / "Days N–M" label per stop is derived by walking the stops in order and accumulating
- Fixed two PrimeNG v21 API mismatches found via UAT: `p-autoComplete` uses `optionLabel`, not `field` (silently fell back to rendering `[object Object]`); `p-message`'s `text` input is deprecated in favor of `<p-message>content</p-message>` projection
- i18n: `trip.planner.step1.*`, `trip.planner.step2.*`, `trip.planner.startOver`/`startOverConfirm` added across en/de/fr/it
- Feature marked complete

### 2026-07-15 — Connection Leg Picker Journey Detail Restored

- Branch: `feature/connection-leg-detail`; specced in `context/features/connection-leg-detail-spec.md`
- Restored the rich rail-connection detail UI that the Phase 1 rebuild had regressed to a flat one-line summary — ported verbatim from commit `cd1a672` (last commit before the old wizard was deleted), since the underlying data (`TripConnection.sections`/`TripSection*` in `models/trip.ts`, populated by `transport.ts`'s `mapSections()`) was never touched by the rebuild
- `connection-leg-picker.ts/html/css`: both the already-picked connection and each search-result card now render as a full `.conn-card` — route header with expand chevron, transfers/duration meta row, timeline bar, and an expandable per-section detail (train category/number/direction, platforms, walk connectors); ported `toggleDetail()`/`togglePickedDetail()`, `formatPlatform()`, `formatWalk()`, `firstTrainDeparture()`, `lastTrainArrival()`, `trainColor()`, `categoryLabel()`, `isSelectedConnection()`, and the full `.conn-*` CSS block (colors adapted to this component's existing CSS variables)
- UAT fixes in the same branch: section heading changed from "Connections" to "Train Connections" (`trip.planner.connections` key, all locales); briefly added then removed a "Change" button on the picked-connection card (plus a `clearConnectionLeg()` service method it depended on) — turned out unnecessary since the leg's own header toggle already re-reveals the search form and previous results list once a connection is picked, letting the user pick a different one or search new dates without any extra affordance
- Feature marked complete

### 2026-07-14 — Hike/Bike Elevation Profile Implemented

- Branch: `feature/hike-bike-elevation`
- Backend: `schweizMobilRoutes.js` — added `fetchElevationProfile(stages)`, `fetchLineProfile(line)` (POSTs to geo.admin.ch's `profile.json`, form-urlencoded body with the `Content-Type` header set explicitly without a charset — geo.admin.ch 415s on axios' default `;charset=utf-8`); rebases each line's cumulative `dist` against a running total for one continuous distance axis across stages
- `hikingRoutes.js`/`bikeRoutes.js` controllers: added `getHikesElevation`/`getBikesElevation` (400 on missing `stages`, 404 if the profile comes back with fewer than 2 usable points); `routes/hikingRoutes.js`/`routes/bikeRoutes.js` mounted `POST /elevation` on each
- Frontend: `models/elevation-profile.ts`; `trail-routes.ts` gained `getElevationProfile(kind, route)`; new `shared/elevation-chart/` — hand-rolled SVG area chart (single-hue line/fill, hairline gridlines, muted axis labels, pointer + keyboard crosshair/tooltip), built per the `dataviz` skill's form/color/interaction rules, takes an `ariaLabel` input so the shared component isn't coupled to the hikes/bikes i18n namespace
- `hike-detail`/`bike-detail`: added `elevationProfile`/`elevationLoading`/`elevationError` signals, fetched via a `Subject`+`switchMap` effect keyed off the drawer payload (same pattern as `attraction-detail`); template renders an "Elevation profile" section (ascent/descent stat row + chart) with a skeleton while loading and a `p-message` warn on error
- i18n: `hikes.elevation.*`/`bikes.elevation.*` (`title`, `ascent`, `descent`, `loadError`) added across en/de/fr/it
- UAT fixes in the same branch: moved the elevation section above the GPX download button; ascent styled red, descent green; ascent/descent/min/max now display to 2 decimal places (`number:'1.2-2'`) instead of whole meters
- Fixed a real accuracy bug found via UAT: geo.admin.ch's `profile.json` ignores the `nb_points` cap whenever the input line already has more vertices than that (returns one DEM sample per original digitized vertex instead of resampling down) — for a 20km route this meant summing every raw delta across ~2,300 points, overcounting ascent/descent by ~7% against SchweizMobil's own published figures (confirmed against "Sentier du Rhône (Genève - La Plaine)": raw sum gave 494.2m/514.0m ascent/descent vs SchweizMobil's published 460m/480m). Replaced raw delta-summation with a 0.5m noise-threshold/hysteresis filter (only count a climb/descent once cumulative movement clears the threshold, then reset the baseline) — verified this lands within ~1% of SchweizMobil (455m/475m)
- `angular.json`: bumped production budgets (initial 500kB/1MB → 1MB/3MB warning/error; component-style 4kB/8kB → 6kB/12kB) — the app's bundle was already over the old budgets before this feature; the failure surfaced when this feature's build ran
- Feature marked complete

### 2026-07-13 — Destination Detail Hikes, Bike Rides, Hotels Implemented

- Branch: `feature/dest-detail-hikes-bikes-hotels`
- Backend: `utils/schweizMobilRoutes.js` — shared util factored out of `hikingRoutes.js` (identify call, stage-grouping, category calc), plus new distance calc (normalizes LineString/MultiLineString stage geometry to per-line arrays via `getLines()`, sums Euclidean distance per line), LV95→WGS84 reprojection (`geometryWgs84`, also normalized to `MultiLineString`), and GPX builder (`buildGpx()`, one `<trkseg>` per line)
- `controllers/hikingRoutes.js` rewritten to use the shared util; added `getHikesGpx` (`POST /api/v1/hikes/gpx`)
- New `controllers/bikeRoutes.js` + `routes/bikeRoutes.js` mirroring hikes with the `ch.astra.veloland` layer; mounted `/api/v1/bikes` in `server.js`
- Frontend: `models/trail-route.ts` (`TrailRoute`/`TrailStage`/`TrailGeometry`, `trailCategoryColor()`), `shared/services/trail-routes.ts` (`TrailRoutesService`, parameterized by `kind: 'hike'|'bike'`), `shared/services/hike-markers.ts`/`bike-markers.ts` (marker state services, `providedIn: 'root'`)
- `shared/trail-thumbnail/` — hand-rolled SVG route-shape thumbnail, one `<polyline>` per line segment (not merged into one path — a route's stages can be disconnected)
- New `features/hikes/hikes-list`+`hike-detail`, `features/bikes/bikes-list`+`bike-detail`, `features/hotels/hotels-stub` components
- `map.ts`: added independent `trailRoute`/`trailColor` second-line input (rendered as `MultiLineString`, separate from `tripRoute`/`tripType`); `activeMarker` input extended with optional `zoom` override
- `drawer.ts`: extended `DrawerKey` with `hikes`/`hike-detail`/`bikes`/`bike-detail`/`hotels`; `drawer-host.ts/.html` wired with back-nav handlers for all five
- `destination-detail.ts/.html`: removed "Plan a Trip" link/`RouterLink`; added Hikes/Bike Rides/Hotels activity cards (`.activity-cards`/`.activity-card`)
- `destinations-layout.ts/.html`: marker-visibility gating for hike/bike pins (mirrors existing attraction gating); `onMarkerClick` opens hike-detail/bike-detail from map pins; reopen buttons for collapsed hikes/bikes/hike-detail/bike-detail
- i18n: `hikes.*`/`bikes.*`/`hotels.*` added, `destinations.detail.planTrip*` removed, across en/de/fr/it
- Follow-up fixes from UAT feedback in the same branch:
  - Radius selector (5/10/20/30 km, default 30) and category filter (All/National/Regional/Local) added above each list, via `p-selectButton`
  - Route click now only requires collapsing the detail drawer to see the map (auto-collapses the underlying list drawer too, instead of requiring two manual collapses)
  - Local-category color changed `#eab308` → `#d97706` for better contrast
  - Fixed a real bug: geo.admin.ch returns `MultiLineString` (not `LineString`) for routes with gaps/multiple stages; flattening all stages into one continuous line drew straight criss-crossing connectors across gaps. Map and thumbnail now render each line segment independently (`MultiLineString`/multiple `<polyline>`s) instead of one merged path — matches how the GPX export already worked (one `<trkseg>` per line)
  - Fixed filter state (radius/category) persisting across destinations: moved `radiusKm`/`selectedCategory` off the list components (which PrimeNG can reuse across drawer open/close under fast interaction, per an animation-timing race in `onAfterLeave`) and onto `HikeMarkersService`/`BikeMarkersService` (true singletons), with `resetFiltersForDestination()` comparing destination object identity to decide whether to reset to defaults
  - Selecting a hike/bike (from its card or its map pin) now flies the map to the midpoint of the route's start/end coordinates at zoom 10 (attractions still center on their own point at zoom 15)
- Feature marked complete

### 2026-06-15 — Trip Planner Wizard Specced

- Specced a step-based wizard for the Trip Planner drawer; see Goals above for full decisions
- Created `feature/trip-planner-wizard` branch (off `feature/trip-things-to-do`, which was
  committed as `bdc419e`) and `context/features/trip-planner-wizard-spec.md`

### 2026-06-16 — Trip Planner Wizard Implemented

- Wizard step model (`TripStep` type, `step` signal, `steps`/`currentStep` computed) added to `TripPlanner` component
- `canGoNext`/`nextHint` computed signals gate Back/Next navigation per step
- `goNext()`/`goBack()` navigation methods added
- `searchedConnections` signal tracks whether a connection search has been attempted (controls empty-state message)
- `onTypeChange()` resets step and `searchedConnections` on type toggle
- Error handler for `findConnections()` now also sets `searchedConnections` to true
- i18n keys added for all wizard steps across en/de/fr/it
- CSS updated for wizard layout and step-specific panels
- Template restructured into step-gated sections with Back/Next controls

### 2026-06-16 — Trip Planner Fixes Specced

- Created `context/features/trip-planner-fixes-spec.md` covering 11 UX/layout fixes for the wizard
- Key items: title layout, tripType button color, connections form overhaul (float label removal, time-only datepicker, remove Find Connections button), linear step enforcement, hide Back on step 1, full-height connections list, connection card time row

### 2026-06-16 — Trip Planner Fixes Implemented

- Branch: `feature/trip-planner-fixes`
- `drawer-host.html/css`: added `.tp-header-brand` (flex row) so icon + title sit on one row; overrode `.tp-drawer .p-drawer-content` to `overflow: hidden` so trip-planner owns its own scroll
- `trip-planner.css`: restructured to flex-column host layout; added `.tp-content` scrollable area; `.tp-section--fill` for full-height connections step; `#285278` selected button color; prominent `.stop-things-link` (border + bg); `.save-actions-row` for side-by-side save buttons; `flex-wrap: nowrap` on `.conn-times`
- `trip-planner.html`: `.tp-content` wrapper around `@switch`; Back button hidden on step 0 (spacer keeps grid); `p-floatLabel` replaced with plain labels on connections form; time input replaced with `p-datePicker [timeOnly]="true"`; Find Connections button removed; Next button shows `[loading]` while searching; connection step uses `.tp-section--fill`; save/view buttons wrapped in `.save-actions-row`
- `trip-planner.ts`: `connTime` signal changed to `signal<Date | null>(null)`; `canGoNext` for 'schedule' returns `!connectionsLoading()`; 'schedule' hint removed from `nextHint`; `goNext()` calls `findConnections()` when on schedule step; `findConnections()` extracts HH:MM from Date and auto-advances to connection step on success

### 2026-06-16 — Round Trip & Reordering Spec Added

- Round trip toggle implemented on the stops step: mirrors last stop to origin, keeps them in sync on origin change, locks end stop input and hides its remove button; resets on type change
- `swissNow()` helper added (uses `Intl.DateTimeFormat` with `Europe/Zurich`); `connDate`, `connTime`, and `today` now default to Swiss CET/CEST
- i18n key `trip.planner.roundTrip` added across en/de/fr/it
- Branch committed as `b475193`
- Created `context/features/trip-planner-reordering-spec.md` for next feature (Angular CDK drag-drop on via stops only; connections list explicitly out of scope)

### 2026-06-16 — Map View Fixes

- `trip-planner-layout.ts`: `tripBounds` now passes the full route polyline to `applyFitBounds` (instead of just first/last point) so round trips zoom to show the full route; added `tripStopPoints` computed signal mapping `trip().stops` → `[lon, lat][]`
- `trip-planner-layout.html`: passes `[tripStopPoints]` to `app-map`
- `map.ts`: added `@Input() tripStopPoints`; road trip markers now use `fa-circle-dot` (green) for origin, `fa-location-dot` (red) for destination, and navy numbered circles for via stops

### 2026-06-17 — Stop Reordering Completed

- Feature reviewed and accepted; branch `feature/trip-planner-reordering` marked complete

### 2026-06-17 — Transport Connection Detail Specced

- Specced redesigned connection cards for the rail trip planner connection step
- Created `feature/transport-connection-detail` branch and `context/features/transport-connection-detail-spec.md`
- Key decisions: section data mapped from existing `/connections` API (no backend changes); `TripConnection.sections` is optional for backwards compatibility; card click = select, chevron click = expand/collapse detail; walk sections shown as connectors between journey legs

### 2026-06-17 — Transport Connection Detail Implemented

- `models/trip.ts`: added `TripSectionStop`, `TripSectionJourney`, `TripSection` interfaces; `TripConnection` extended with optional `sections?: TripSection[]`
- `transport.ts`: added `SectionStop`, `SectionJourney`, `SectionWalk`, `ConnectionSection` interfaces; replaced broad `sections` type on `ConnectionResult`; added `mapSections()` private method; `getConnections` mapping now includes `sections`; `extractPassListCoords` parameter updated to `ConnectionSection[]`
- `trip-planner.ts`: removed `Tag`/`Chip` imports (no longer used); added `expandedConnectionIndex` signal; `onTypeChange` and `findConnections` both reset it; added `toggleDetail()`, `formatPlatform()`, `trainColor()`, `categoryLabel()` methods
- `trip-planner.html`: connection step `@for` block fully replaced — new `.conn-card` (clickable, selectable), header row (route + chevron), meta row (transfers + duration), timeline bar, expandable `.conn-detail` with per-section journey stops/train/walk rendering
- `trip-planner.css`: old `.conn-row`/`.conn-main`/`.conn-times`/tags styles replaced with new card, header, meta, timeline, stop, leg, walk, and platform-badge rules
- `en/de/fr/it.json`: added `trip.planner.transfer` (singular) and `trip.planner.connection.direction`/`connection.walk` keys in all four locales

### 2026-06-18 — Transport Connection Detail Fixes

- Walk duration: API returns seconds; `formatWalk()` converts to minutes (`Math.floor(s/60)`), returns `''` for null/undefined/under 60s; template renders "Walk" alone or "Walk · X min" with duration appended — `{{duration}} min` parameter removed from all four i18n `walk` keys
- Timeline times: `firstTrainDeparture()` and `lastTrainArrival()` helpers find the first/last journey section's times, skipping any leading/trailing walk sections that were inflating the displayed range
- Train label: changed from `section.journey.name` (API combined field) to `section.journey.category + section.journey.number` so the display is built from discrete fields as intended

### 2026-06-18 — Transport Connection Detail Completed

- Feature reviewed and accepted; branch `feature/transport-connection-detail` marked complete


### 2026-06-19 — Map Marker Anchor Fix

- All MapLibre custom markers now wrap the Font Awesome `<i>` icon in a 28×28px `.map-marker-container` flex div; MapLibre measures the container for its `anchor: 'center'` calculation, giving precise coordinate alignment at all zoom levels
- Without the wrapper, MapLibre measured the `<i>` element's unreliable inline font-metric bounding box, producing a fixed CSS-pixel offset that appeared as large geographic drift at low zoom and shrank on zoom-in

### 2026-06-19 — Misc Fixes 2 Implemented

- Branch: `feature/misc-fixes-2`
- `trip-planner.ts` (service): added `DRAFT_KEY` constant; constructor restores draft from `localStorage` on app load; `_trip$` subscription with `debounceTime(300)` + `skip(1)` auto-saves stops/type/name/routeCoordinates; added `clearDraft()` method; removed `catchError` from `buildRoadRoute()` so errors propagate
- `trip-planner.ts` (component): added `routeError` signal; `onStopsChanged()` now catches route errors and sets `routeError`; calls `plannerSvc.clearDraft()` on type change and on successful save; added `moveStopUp()`/`moveStopDown()` methods; added `getStopSelections()`/`getAttractionName()` helpers for finish summary; imported `Panel`
- `trip-planner.html`: route error `p-message` below stop list skeleton; keyboard move-up/down buttons on via-stop rows (`.stop-kbd-btns`); `aria-label` on each `p-autoComplete` (From/To/Via N), remove button, and drag handle; finish step trip summary (`trip-summary` block with `stop-indicator` + `p-panel` per stop with attractions)
- `trip-planner.css`: `.stop-kbd-btns` hidden by default, shown on `.stop-row:focus-within`; `.stop-kbd-btn` styles; full finish-step summary styles (`.trip-summary`, `.summary-stop-row`, `.summary-panel`, `.summary-attraction-row`)
- `attraction-vertical-list.ts/html`: added `loadError` signal; `catchError` in pipe returns null sentinel; template shows `p-message severity="warn"` instead of skeleton on error
- `all-attractions.ts/html`: added `loadError` signal; `loadMore()` error handler sets it; template shows `p-message` in the non-search list branch
- `things-to-do.ts/html`: added `loadError` signal; `catchError` on `fetchTrigger$` inner observable; reset clears error; template shows `p-message` between skeleton and empty states
- `attraction-detail.ts/html`: added `loadError` signal; `catchError` in `fetchTrigger$` pipeline; error resets on payload clear; template shows `p-message` above the gallery skeleton
- `map.ts`: replaced `markerInstances: Marker[]` with `Map<string, { marker, el }>`; added `markerKey()`/`buildMarkerEl()`/`addMarker()` helpers; `syncMarkers()` now diffs by key — removes stale, updates `className`/`color` in-place, adds only new; `ngOnDestroy` iterates the Map
- `footer-nav.ts`: injected `Router`; `showNav` signal via `toSignal` on `NavigationEnd` events — true only for `/destinations/:id` and `/trip-planner[/:id]`; host binding `[style.display]` hides nav on all other routes
- `drawer-host.html`: `[attr.aria-label]` added to all `menu-close` buttons (close or show-on-map) using `nav.close` / `nav.showOnMap` keys
- `en/de/fr/it.json`: added `trip.planner.routeError`, `removeStop`, `dragStop`, `moveStopUp`, `moveStopDown`, `attraction`, `attractions`; added `attractions.loadError` and `attractions.detail.loadError`; added new `nav.close` / `nav.showOnMap` section

### 2026-06-19 — Misc Fixes 1 Implemented

- Branch: `feature/misc-fixes-1`
- `trip-planner.html`: wrapped Round Trip button in `@if (selectedType() !== 'rail')` to hide it for rail trips; replaced `.stop-input-row` + `.stop-actions` structure with `p-inputGroup` containing two `p-inputGroupAddon` slots (remove × and drag ⠿ icons inline in the input); moved `[class.stop-action--hidden]` to the inner icon/button so addon borders always render and every row looks the same width
- `trip-planner.ts`: imported `InputGroup` and `InputGroupAddon` from PrimeNG
- `trip-planner.css`: replaced old `.stop-input-row`/`.stop-actions`/`.stop-remove` rules with `.stop-input-group`, `.stop-addon`, `.stop-icon-btn`, and drag-addon styles; suppressed focus/hover border-color and box-shadow on autocomplete input inside the group
- `trip-planner-layout.ts`: added `displayedTripRoute` and `displayedTripStopPoints` computed signals that return `null`/`[]` while the trip-planner drawer is open, deferring route display on the map until Save/View Trip collapses the drawer; added `clickable: true` to `tripAttractionMarkers`; injected `AttractionMarkersService`; added `onAttractionMarkerClick()` to open `attraction-detail` drawer with `source: 'trip-planner'`; default `center` set to Switzerland `[8.2275, 46.8182]`; added `mapZoom` signal (default 7, set to 12 on destination load, 10 on stored route center)
- `trip-planner-layout.html`: switched `[tripRoute]`/`[tripStopPoints]` to `displayedTripRoute()`/`displayedTripStopPoints()`; wired `(markerClick)="onAttractionMarkerClick($event)"`; changed `[zoom]` to `[mapZoom()]`
- `attraction-detail.ts`: added `'trip-planner'` to `AttractionDetailPayload.source` union type
- `drawer-host.html`: added `@else if (attractionDetailSource() === 'trip-planner')` branch for the attraction-detail back button label
- `drawer-host.ts`: `onAttractionDetailBack()` now handles `source === 'trip-planner'` — closes attraction-detail and reopens trip-planner
- `map.css`: removed `max-width` on popup to fix tooltip truncation; moved `maplibregl-ctrl-bottom-right` bottom offset from mobile-only media query to unconditional (footer-nav is now visible at all widths)
- `footer-nav.css`: changed desktop media query (`≥600px`) to hide `.footer-btn` only, leaving the nav bar itself visible
- `header-nav.css`: added `border-bottom: none; box-shadow: none` to p-menubar to eliminate white visual gap below the header
- `trip-planner-layout.css` / `destinations-layout.css`: added `background: var(--navy-800)` to host as defensive fallback against any gap between header and map
- `en/de/fr/it.json`: added `trip.planner.backToPlanner` key in all four locales

### 2026-06-16 — Stop Reordering Implemented

- Branch: `feature/trip-planner-reordering`
- `@angular/cdk@21` installed
- `trip-planner.ts`: imported `DragDropModule`, `CdkDragDrop`, `moveItemInArray`; added `reorderStop(event)` handler — clamps drop index to via-stop range (1..n-2), moves both `stops` and `stopSuggestions` in sync, then calls `onStopsChanged()`
- `trip-planner.html`: `cdkDropList` + `(cdkDropListDropped)` on `.stop-list`; `cdkDrag` + `[cdkDragDisabled]` (disabled for origin, destination, and while loading) on each row; `cdkDragHandle` grip icon shown only for via stops; `*cdkDragPreview` shows stop name with grip icon; `*cdkDragPlaceholder` renders dashed empty slot
- `trip-planner.css`: `.stop-drag-handle` (grab cursor, right-aligned); `.stop-drag-preview` (white card + box-shadow); `.stop-drag-placeholder` (dashed border); CDK animation transitions

### 2026-07-03 — Home Categories Specced

- Specced two new home page destination sections (Mountains, Lakes & Glaciers; Nature Parks) alongside the existing City Breaks section, all sharing `DestinationHorizontalList`
- New `destination-category.ts` model (`CategoryKey`/`CategoryConfig`/`DESTINATION_CATEGORIES`) to centralize per-category facets, copy keys, and map icon; `DestinationVerticalList` to become dynamic via `?category=` query param instead of static `@Input()`s
- Created `context/features/home-categories-spec.md`; no feature branch created yet

### 2026-07-08 — Home Categories Implemented

- `models/destination-category.ts`: new model with `CategoryKey` type, `CategoryConfig` interface, and `DESTINATION_CATEGORIES` record (`cities`/`mountains-lakes`/`nature-parks`) centralizing facets, title/subtitle/pageSubtitle copy keys, card title, and map icon per category
- `home.html`/`home.css`: replaced `.destinations-section` with banded `.home-section`/`.section-inner` layout; three `DestinationHorizontalList` sections (City Breaks, Mountains/Lakes/Glaciers, Nature Parks) with alternating white/`#f5f6f7` backgrounds and `viewAllQueryParams` carrying `?category=`
- `destination-horizontal-list.ts/html`: added `viewAllQueryParams` input, bound alongside `routerLink` on the "View all" link
- `destination-vertical-list.ts/html`: now reads `?category=` via `ActivatedRoute`, resolves `CategoryConfig` from `DESTINATION_CATEGORIES` (defaults to `cities`), holds it in a signal, re-fetches on category/language change, and drives title/subtitle/card badge/map icon from the config; removed the now-unused static `@Input()`s
- `en/de/fr/it.json`: added `destinations.mountains` and `destinations.natureParks` keys (title/subtitle/count) in all four locales

### 2026-07-08 — Destination Detail Fixes 2 Specced

- Specced 5 fixes to `destination-detail`/map/drawer/trip-planner chrome, prompted by the new home-page categories: (1) hide attraction UI when a destination has 0 attractions; (2) destination-detail map shows only a red/bigger destination pin, attraction pins gated to the all-attractions context; (3) Plan Trip/weather boxes side by side via a two-column `.action-grid`; (4) dynamic "back to destinations" via a `?category=` query param carried through destination links; (5) road-trip prefill seeded from the destination's own `dest.geo` instead of an address search (fixes mountain/lake/glacier destinations with no street address) — rail nearest-station lookup deferred
- Created `context/features/dest-detail-fixes2-spec.md`; no feature branch created yet

### 2026-07-10 — Destination Detail Fixes 2 Implemented

- Branch: `feature/dest-detail-fixes-2`
- `attraction-markers.ts`: added `hasAttractions` signal (default `true`) + `setHasAttractions()`, reset in `clear()`
- `attraction-vertical-list.ts/html`: reports `hasAttractions` after load; stopped seeding map markers from the top-attractions list; `onAttractionClick` now opens `attraction-detail` directly with `source: 'destination-detail'`; whole section hidden once loaded with zero attractions
- `destinations-layout.ts/html`: added `destinationMarker` (red, `.destination-marker` class, always shown) and `showAttractionMarkers`/`displayMarkers` gating so attraction pins only render while on the all-attractions list (open, collapsed, or an attraction-detail reached from it); reopen buttons gated on `attractionMarkers.hasAttractions()`
- `drawer-host.ts/html`: `onAttractionDetailBack()` handles `source: 'destination-detail'`; `onDestinationBack()` reads `category` off the current URL (`Router.parseUrl`) and forwards it instead of always defaulting to `/destinations`
- `map.css`: `.destination-marker` (2.2rem, red)
- `destination-detail.css`: `.action-grid` → two columns (Plan Trip / Weather side by side, equal height via CSS Grid stretch), single column under 400px
- `destination-horizontal-list.ts/html`, `destination-vertical-list.ts/html`, `home.html`: new `categoryKey` input carries `?category=` on every destination-card link
- `trip-planner-layout.ts`: road-trip prefill payload changed from a bare name string to `{ name, lat, lon, identifier }` when geo is known
- `trip-planner.ts`: prefill effect seeds the 'to' stop directly from destination coordinates for road trips (bypassing address search); `TripPlannerService.buildRoadRoute()` throws `NO_ROAD_ROUTE` when OSRM returns non-`Ok`, surfaced via new `routeUnreachable` signal that blocks `canGoNext`/shows a dedicated error message; pre-filled 'to' stop is locked (`destinationLocked`) — disabled input, hidden remove button
- i18n: `trip.planner.routeUnreachable` added across en/de/fr/it
- Follow-up fixes in the same branch: removed the round-trip feature entirely (`isRoundTrip`, `toggleRoundTrip()`, button, CSS, `roundTrip` i18n key); fixed a long-standing typo where PrimeNG's addon class is `p-inputgroupaddon` (no hyphen) not `p-inputgroup-addon` — every addon override rule (background, hover, drag cursor, and the new `.stop-addon--disabled` gray-out) was silently dead until corrected; `trip-planner-layout.ts/html` gained `displayedTripAttractionMarkers`, hiding "things to do" pins until the drawer collapses (Save/View Trip), mirroring the existing route/stop-marker gating; `map.ts/css` — attraction marker containers now carry their `className` via safe `classList` diffing (preserves MapLibre's own marker class) and get `z-index: 5` so they stay clickable over overlapping destination/route markers; road route line is now solid `#1a2f4a` (was dashed green), rail unchanged; `trip-planner.ts` prefill effect now detects a genuinely new destination (vs. resuming a restored draft for the same one) and calls `resetForNewDestination()` — wipes route/stops/attraction cache via `plannerSvc.reset()`, resets wizard step to 0, clears connections/trip name
- Feature marked complete
