# Homepage Search Section

## Overview

Add a global search section to the homepage, sitting between the hero and the "City
Breaks" section, letting users search for either **destinations** ("Places to visit") or
**attractions** ("Things to do"). Results open into the existing `destination-detail`
route/drawer or `attraction-detail` drawer, same as today's browsing flows. A "Search"
link is added to both the slide-out menu (`menu-nav`) and the footer nav
(`footer-nav`), routing to a new dedicated `/search` page that hosts the full results
experience.

Mockup: `context/screenshots/homepage_search.png` — **journey/layout reference only, not
an exact color/pixel spec** (per the user: colors shown aren't final). It shows two tabs
("Places to visit" / "Things to do", left one active) above a rounded search input with a
leading magnifying-glass icon and a filled "Search" button to its right, all inside a
white card.

## Why this shape (confirmed decisions from brainstorm)

- **Two tabs, not a merged results feed.** Destinations and attractions are fetched via
  fully separate MySwitzerland API calls (no combined/multi-type search endpoint exists
  today, and destinations currently have **no free-text search parameter at all** — only
  `searchAttractions` adds MySwitzerland's `query` param). Splitting into tabs means we
  only ever fire the query for the tab the user is actually looking at, instead of always
  paying for both calls up front.
- **Submit-based search, not type-ahead.** Matches the existing pattern in
  `all-attractions.ts`'s `onSearch()` (see `context/features/attrac-list-search-spec.md`)
  — press Enter / click Search, no debounce/live-as-you-type. Lower API load, fewer moving
  parts, no request-cancellation logic needed.
- **Lazy per-tab fetch.** Only the active tab's query executes. Switching to the other tab
  triggers *its* fetch (if that tab hasn't already been searched for the current query
  text) rather than re-running the tab you just left.
- **Per-(tab, query) result caching** in the results component, so flipping back and forth
  between tabs you've already searched doesn't refetch — cleared when the query text
  changes.
- **Dedicated route (`/search`), not a drawer.** Search is a global, top-level action
  reachable from the nav menu and footer (not scoped to a specific destination), so it
  gets a real, shareable, bookmarkable URL (`/search?q=...&tab=places|things`) with normal
  back-button behavior — consistent with how `/explore-trips` is a routed page rather than
  a drawer.

## Backend

New handler in `backend/src/controllers/myswitzerland.js`, mirroring `searchAttractions`'s
existing shape (`getAttractions` vs `searchAttractions` = same relationship as
`getDestinations` vs this new `searchDestinations`):

```js
export const searchDestinations = asyncHandler(async (req, res, next) => {
  const config = {
    method: 'get',
    url: `${process.env.MYS_ENDPOINT}/v1/destinations/?lang=${req.query.language}&page=${req.query.page}&query=${encodeURIComponent(req.query.search)}&hitsPerPage=${req.query.hitsPerPage}&facets.translate=${req.query.translate}&expand=${req.query.expand}&striphtml=${req.query.stripHtml}`,
    headers: {
      'x-api-key': process.env.MYS_KEY,
      accept: 'application/json'
    },
  };
  try {
    let response = await axios(config);
    if (!response.data) {
      return next(new ErrorResponse(`No destination data found`, 404));
    }
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error(error);
    next(new ErrorResponse(`An error occurred during the request: ${error}`, 500));
  }
});
```

`backend/src/routes/myswitzerland.js`: add
`router.get('/searchdestinations', cacheResponse(), searchDestinations);` — same
`cacheResponse()` middleware already applied to every other route (see
`context/features/myswitzerland-redis-cache-spec.md`), so repeat/popular searches are
served from Redis instead of hitting MySwitzerland again.

## Frontend — services

`frontend/src/app/shared/services/destinations.ts` gains a `searchDestinations` method,
mirroring `AttractionsService.searchAttractions` (`shared/services/attractions.ts:81-102`):

```ts
searchDestinations(params: {
  language: string;
  page: number;
  search: string;
  hitsPerPage: number;
  expand: boolean;
}): Observable<Destination[]> {
  const httpParams = new HttpParams()
    .set('language', params.language)
    .set('page', params.page)
    .set('search', params.search)
    .set('hitsPerPage', params.hitsPerPage)
    .set('expand', String(params.expand))
    .set('translate', 'true')
    .set('stripHtml', 'false');

  return this.http
    .get<DestinationsResponse>(`${this.baseUrl.replace('/destinations', '')}/searchdestinations`, { params: httpParams })
    .pipe(map(res => res.data.data));
}
```

`AttractionsService.searchAttractions` is reused as-is for the "Things to do" tab — no
changes needed there.

## Frontend — homepage section

New section in `home.html`, inserted between the closing `</section>` of `.hero` and the
first `.home-section` (City Breaks). Structure mirrors the mockup: two-tab header (map-pin
icon "Places to visit" / bolt icon "Things to do") over a white rounded card containing a
single shared search input + Search button.

- **Positioning**: per the user's request, the card should sit slightly above the bottom
  of the hero. Implementation approach: negative top margin on the new section (pulling it
  up over the hero's bottom edge — hero height is a fixed `500px`/`700px` at the
  `min-width: 1024px` breakpoint per `home.css`), with `position: relative` +
  appropriate `z-index` so the card paints above `.hero-overlay`. Exact overlap amount is a
  CSS/visual-tuning detail, not spec-fixed.
- **One shared query input** drives whichever tab is active — typing once and hitting
  Search fetches for the currently-selected tab only.
- Component is standalone (e.g. `HomeSearch`), embedded directly in `home.html` — it's the
  same component that also becomes the `/search` page's header/control (see below), so the
  search box behaves identically whether triggered from the homepage or from `/search`
  itself.

## Frontend — `/search` route and results page

- New route `{ path: 'search', component: SearchPage }` under `MainLayout` in
  `app.routes.ts` (sibling of `explore-trips`), so it's a normal page (header/footer nav
  visible, not a drawer/overlay).
- Submitting the homepage search box navigates to `/search?q=<value>&tab=places|things`
  (whichever tab was active on the homepage) rather than performing the fetch inline on the
  homepage itself — the homepage card is purely an entry point.
- `SearchPage` uses PrimeNG's Tabs component (`p-tabs` / `p-tablist` / `p-tab` /
  `p-tabpanels` / `p-tabpanel` — the current, non-deprecated PrimeNG v21 API; not used
  anywhere else in the app yet, so this is a first usage) with two panels:
  - **Places to visit**: own child component, calls `DestinationsService.searchDestinations`
    on activation (if not already cached for the current `q`), renders results reusing the
    existing `.destination-card` markup/styling from `destination-vertical-list.html`.
  - **Things to do**: own child component, calls
    `AttractionsService.searchAttractions`/`searchAttractionsNearby` on activation, renders
    results reusing whatever card markup `all-attractions` already uses.
- Query text and active tab live in the URL (`?q=`, `?tab=`) so the page is
  shareable/bookmarkable and browser back/forward works naturally between searches.
- No-results messaging per tab, following the existing pattern/tone from
  `attrac-list-search-spec.md` ("I'm sorry, we couldn't find any... Please try another
  keyword"), translated per tab (destinations vs attractions wording).
- Loading state: skeleton cards, consistent with the existing skeleton pattern in
  `destination-vertical-list.ts`/`all-attractions.ts`.

## Result → drawer/route linking

- **Destination result** → `router.navigate(['/destinations', dest.identifier])` — reuses
  the existing flow where `DestinationsLayout` opens the `destination-detail` drawer
  automatically from the route param, same as clicking a destination card or map marker
  elsewhere in the app. No new drawer-opening logic needed to *open* it. This is a real page
  navigation, not an overlay — `/search` is left behind in browser history, not visible
  underneath.
- **Attraction result** → open the `attraction-detail` drawer directly:
  `drawerSvc.open('attraction-detail', { attraction, destination: <minimal GeoLocation from result>, source: 'search' })`.
  `AttractionDetailPayload.source`'s union type
  (`attraction-detail.ts:15-23`) gains a new `'search'` value alongside the existing
  `'destination-detail' | 'all-attractions' | 'trip-summary' | 'map'`. Back-nav from this
  drawer instance should close back to `/search` rather than reopening `all-attractions`. This
  case is already an overlay on top of `/search`, so no extra origin-tracking is needed here
  — it's the destination case below that needs it.

### Origin-aware back navigation for `destination-detail`

`onDestinationBack()` (`drawer-host.ts:50-54`) today only knows one origin — it reads the
`category` query param off the current URL and always navigates to
`/destinations?category=<x>` (the destinations list). That's a problem for search: a
destination reached via a search result has no meaningful `category`, so back would land
the user on an unrelated destinations list (defaulting to "cities") instead of returning
them to their search. This needs to become origin-aware, following the same pattern already
used by `AttractionDetailPayload.source` and `ActivityPickerPayload.origin` elsewhere in the
app for exactly this "which page reopens on back" problem:

- When navigating to a destination from a search result, tag the URL with where it came
  from and enough state to reconstruct it:
  `router.navigate(['/destinations', dest.identifier], { queryParams: { from: 'search', q: query, tab: 'places' } })`.
- `onDestinationBack()` checks for `from === 'search'` on the current URL first. If present,
  navigate back to `/search?q=<q>&tab=<tab>` instead of `/destinations?category=...`.
  Otherwise, fall through to today's existing `category`-based behavior unchanged — this is
  additive, not a rewrite of the existing destinations-list back flow.

## Navigation

- `menu-nav.html`: add a new `<li class="nav-item" routerLink="/search">` entry (search
  icon, e.g. `pi pi-search` to match the existing `pi-*` icon set used by sibling items),
  positioned near the top of the nav list (e.g. right after Home).
- `footer-nav.html`: add a new icon-only `<a routerLink="/search">` button, same markup
  pattern as the existing four buttons (`fa-light` icon wrapped in `.footer-icon-wrap`).

## i18n

New keys across `en`/`de`/`fr`/`it`, exact key set finalized during implementation, at
minimum:

- `nav.search` — nav-menu label
- `home.search.placesTab` ("Places to visit"), `home.search.thingsTab` ("Things to do")
- `home.search.placeholder` ("Search a city, country, or region…" — likely a different
  placeholder per active tab, e.g. attractions-flavored wording on the "Things to do" tab)
- `home.search.searchButton` ("Search")
- `home.search.noDestinationResults`, `home.search.noAttractionResults` — no-results
  messaging per tab

## Out of scope

- Type-ahead/live search-as-you-type (explicitly rejected in favor of submit-based, per
  confirmed decisions above).
- Merging destinations + attractions into a single unified result feed/ranking.
- Search history, saved searches, or autocomplete suggestions.
- Geolocation-based "search near me" — text query only for this phase.

## References

- @context/screenshots/homepage_search.png
- @context/features/attrac-list-search-spec.md
- @context/features/myswitzerland-redis-cache-spec.md
- @context/features/home-hero-spec.md
- @context/features/home-categories-spec.md
- @frontend/src/app/features/home/home.html
- @frontend/src/app/features/home/home.css
- @frontend/src/app/shared/services/destinations.ts
- @frontend/src/app/shared/services/attractions.ts
- @backend/src/controllers/myswitzerland.js
- @backend/src/routes/myswitzerland.js
- @frontend/src/app/features/attractions/attraction-detail/attraction-detail.ts
- @frontend/src/app/shared/services/drawer.ts
- @frontend/src/app/shell/menu-nav/menu-nav.html
- @frontend/src/app/shell/footer-nav/footer-nav.html
- @frontend/src/app/app.routes.ts
- @context/project-overview.md
