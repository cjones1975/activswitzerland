# Current Feature

## Feature

MySwitzerland Redis Cache (`context/features/myswitzerland-redis-cache-spec.md`)

## Status

Specced — branch not yet created

## Goals

- Shared Redis cache (24h TTL) in front of all 7 `/api/v1/myswitzerland/*` proxy endpoints
- Cache key = `mys:` + full request URL (path + query string)
- Fail open: if Redis is unreachable, behave exactly as today (direct MySwitzerland API call)
- No frontend changes

## Notes

## History

<!-- Keep this updated. Earliest to latest -->

### 2026-06-12 — MySwitzerland Redis Cache Specced

- Specced a shared Redis cache for the `myswitzerland` proxy endpoints (destinations, destinations-by-geobox, destination by id, top attractions, attractions, attraction by id, search attractions)
- Cache is shared across users (not per-session) since destination/attraction data is static reference content; 24h TTL agreed so upstream edits are picked up daily
- New `backend/src/middleware/redis.js` (connection, fail-open on connect error — unlike `mongodb.js` it does not exit the process) and `backend/src/middleware/cache.js` (`cacheResponse(ttl = ONE_DAY_SECONDS)` middleware factory, key = `mys:` + `req.originalUrl`)
- `infra/docker-compose.yml` gets a new `redis: redis:7-alpine` service (no persistent volume); `backend/config/.env` gets `REDIS_HOST=redis`/`REDIS_PORT=6379`
- See spec for full details

### 2026-06-12 — Destination & Attraction Fixes Completed

- `DestinationHorizontalList` cards: `<div class="destination-card">` → `<a [routerLink]="['/destinations', dest.identifier]">`, with `text-decoration: none; color: inherit` added in CSS
- `DestinationVerticalList` "view all" cards: removed the `.card-coords` button, `selectMarker()`/`formatCoords()`/`activeMarker` signal, and the `.visit-btn` ("Let's Visit") link; whole card is now `<a [routerLink]="['/destinations', dest.identifier]">`; `<app-map>` no longer takes `[activeMarker]`; `destinations.letsVisit` removed from all four locale files
- `DestinationDetail`'s "Plan a Trip" button replaced with a `.plan-card` `<a [routerLink]="['/trip-planner', dest.identifier]">` matching `.weather-box` (12px radius, 80px min-height); `.action-grid` changed from a 2-column to a 1-column grid; new `destinations.detail.planTripSubtitle` ("By road or rail" / "Mit Auto oder Bahn" / "En voiture ou en train" / "In auto o in treno") shown below the title; removed `openTripPlanner()` and the unused `Router` injection
- `attractions.title` renamed "Top attractions" → "Popular attractions" in all four locales (`titleFallback` unchanged)
- `AttractionVerticalList.onAttractionClick()` and `AllAttractions.onAttractionClick()` now call `AttractionMarkersService.setSelected(attraction.identifier)` instead of opening `attraction-detail`; `AllAttractions` also collapses the `all-attractions` drawer so the map is visible behind it
- `MapComponent` gained `previousView` (captured on the first `activateMarker()` call) and `deactivateMarker()` (flies back to `previousView`, then clears it); `ngOnChanges` now calls `deactivateMarker()` when `activeMarker` becomes falsy instead of doing nothing
- `DrawerHost.onAllAttractionsBack()`, `DestinationsLayout.openDetail()`, and `DestinationsLayout.reopenAllAttractions()` all call `attractionMarkers.setSelected(null)`, clearing the selection and triggering the map's fly-back to `previousView`
- Beyond spec: "Back to destination"/"Open destination" copy now includes the destination name — `attractions.backToDestination` → "Back to {{name}}" and `destinations.detail.open` → "Back to {{name}}" in all four locales, interpolated via a new `allAttractionsDestinationName()` computed in `DrawerHost` and the `dest` template variable in `destinations-layout.html`
- Verified with `tsc --noEmit` and `ng build --configuration development` — both pass

### 2026-06-12 — Destination & Attraction Fixes Specced

- Specced six fixes in `context/features/destin-attrac-fixes-spec.md`: homepage destination cards route like the "view all" cards; "view all" cards drop the coordinates button + "Let's Visit" and route the whole card; `DestinationDetail`'s "Plan a Trip" button becomes a card matching `.weather-box` with a "By road or rail" subtitle; `attractions.title` renamed "Top attractions" → "Popular attractions"; clicking an attraction no longer opens `attraction-detail` (only the map marker's label does); clicking an attraction zooms the map to it via `AttractionMarkersService.setSelected`, with "Back to destination"/"Open destination"/"Open attractions" clearing the selection and restoring the previous map view via a new `MapComponent.previousView`/`deactivateMarker()` mechanism

### 2026-06-12 — Nav Menu Fixes Completed

- Header brand: `<span class="brand">` → `<a class="brand" routerLink="/">ActivSwitzerland</a>` in `header-nav`; `RouterLink` added to imports, `.brand` CSS gained `text-decoration: none` and `cursor: pointer`
- `MenuNav`: new `closeMenu()` helper (`drawer.close('menu-nav')`), used by every nav item that now navigates, mirroring the existing `openAuth()` pattern
- 'Home' nav item: added `routerLink="/"` + `(click)="closeMenu()"`
- 'Map Planner' renamed to 'Trip Planner', `routerLink="/trip-planner"` + `closeMenu()`; i18n key `nav.mapplanner` renamed to `nav.tripplanner` in all four locale files
- New conditional 'Profile' nav item (`pi-user`, `routerLink="/auth/profile"`, `closeMenu()`), shown only when `auth.isLoggedIn()`; `Auth` injected into `MenuNav` as `protected auth`; new `nav.profile` i18n key added to all four locale files
- Log In / Log Out button: icon and label now switch on `auth.isLoggedIn()` (`pi-sign-in`/`pi-sign-out`, `nav.login`/`nav.logout`); `onAuthAction()` calls `auth.logout()` + `closeMenu()` + navigate to `/` when logged in, otherwise falls back to existing `openAuth()`; new `nav.login`/`nav.logout` i18n keys added to all four locale files (de/fr/it values match existing `auth.tabs.login`/`profile.signout` translations)
- `changeLanguage()` now also calls `closeMenu()` so selecting a language closes the drawer
- Verified with `tsc --noEmit` and `ng build --configuration development` — both pass

### 2026-06-12 — Trip Planner Layout Restructure Completed

- New `TripPlannerLayout` shell (`frontend/src/app/shell/trip-planner-layout/`) hosts `<app-map>` full-screen, registered at `/trip-planner` and `/trip-planner/:id` in `app.routes.ts`
- `:id` present → fetches the destination, centers the map on it, and opens the `trip-planner` drawer with the destination name as payload; `:id` absent → opens the drawer with no payload, and centers on the route's bounding-box midpoint once `TripPlannerService.routeCoordinates$` first emits (covers loading a saved trip)
- Map overlay buttons: "Back to destination" (`/destinations/:id`, shown only when `:id` was present) and "Open trip planner" (shown whenever the drawer is closed)
- `Home.openTripPlanner()`, `DestinationDetail.openTripPlanner()`, and `Profile.openTripPlanner()`/`viewTrip()` now `router.navigate()` to `/trip-planner` or `/trip-planner/:id` instead of opening the drawer directly on pages with no map
- `DestinationsLayout` stripped of all trip-planner concerns: removed `TripPlannerService` injection, `tripRoute`/`tripType` signals and subscriptions, `[tripRoute]`/`[tripType]` map bindings, and drawer/reset cleanup in `ngOnDestroy`
- `TripPlannerService`: added `setName()` and `loadSavedTrip()` (restores type/stops/routeCoordinates/name from a `SavedTrip` and re-emits `routeCoordinates$`); `PlannedTrip` gained an optional `name` field
- `TripPlanner` component now restores `selectedType`/`stops`/`stopSuggestions`/`tripName` from `plannerSvc.snapshot` on construction, and calls `setStops()`/`setName()` on every stop or trip-name change — so closing/reopening the drawer or loading a saved trip preserves in-progress state
- `trip.planner.open` ("Open trip planner") i18n key added to all four locale files

### 2026-06-11 — Trip Planner Layout Restructure Specced

- Identified that `Home.openTripPlanner()` navigates to `/destinations` (no map) and `Profile`'s trip-planner CTAs have no map at all — both broken
- Specced new `TripPlannerLayout` shell + `/trip-planner`, `/trip-planner/:id` routes; see Goals above for full decisions
- Committed prior session's uncommitted rail-journey-routing WIP to `main` (`c2364f4`) before branching
- Created `feature/trip-planner-layout` branch and `context/features/trip-planner-layout-spec.md`

### 2026-06-05 — Trip Planner Specced

- Feature brainstormed and fully specced in `context/features/trip-planner-spec.md`
- Trip type: Road Trip (OSRM routing) or Rail Trip (straight-line + optional timetable connections)
- Stop search: `p-autoComplete` with `[minLength]="3"` backed by `TransportService.searchLocations()` → `GET /api/v1/transport/locations`
- Rail connections: optional date/time picker triggers `GET /api/v1/transport/connections`; returns timetable displayed as selectable rows with `p-chip` product labels, `p-tag` transfer count, and `p-button` select action
- Attraction discovery: `geo.dist=lat,lon,10000` per stop via MySwitzerland API, deduplicated by `identifier`; displayed as horizontal thumbnail cards; clicking opens existing `attraction-detail` drawer
- Map: new `[tripRoute]` and `[tripType]` inputs on `MapComponent`; GeoJSON `LineString` layer in green (`#1a6b3c`), dashed for road, solid for rail; numbered stop markers
- Save gate: `p-message` sign-in hint + auth drawer redirect when not logged in; `p-toast` success when logged in
- Trip name: user-editable `pInputText` with `p-floatLabel`; suggested name auto-computed as `{first} → {last}` via computed signal
- Profile: `TripsService.getTrips()` populates saved trips count and new Saved Trips section; 2-column grid on desktop, 1-column on mobile; `ConfirmationService` delete dialog
- PrimeNG components used throughout: `SelectButton`, `AutoComplete`, `DatePicker`, `InputText`, `FloatLabel`, `Button`, `Tag`, `Chip`, `Skeleton`, `Divider`, `Toast`, `ConfirmDialog`, `Message`
- Backend transport proxy endpoints already completed by user; all other backend and frontend work pending

### 2026-06-04 — Attractions List Search Completed
- Search bar added to top of `AllAttractions` drawer: PrimeNG `InputText` with `type="search"`, full-height `<button>` icon (proper mobile touch target), triggers on `keydown.enter`, `(search)` event (mobile keyboard), and icon click
- Search strategy: (1) filter existing loaded records by name/abstract; (2) if none found, call `GET /api/v1/myswitzerland/searchattractions` with params `language`, `page=0`, `search`, `hitsPerPage=50`, `placeId`, `expand=false`, `translate=true`, `stripHtml=false`, `top=true`; (3) if still none, show "I'm sorry…" message
- `AttractionsService.searchAttractions()` added; backend route and controller already existed
- "Back to all attractions" button shown below results in search mode; clears query, exits search mode, and restores the full paginated list
- Search mode disables infinite-scroll sentinel; language change and destination change both reset search state
- `LangService` extracted to `@shared/services/lang.ts` — owns `app-lang` localStorage key and `translate.use()`; replaces 8 raw `localStorage.getItem('app-lang')` calls across 7 components
- Angular environment files created (`environment.ts` / `environment.prod.ts`); all 8 hardcoded `http://localhost:3000` URLs replaced with `${environment.apiUrl}/...`; `fileReplacements` wired into `angular.json` production config; `tokenInterceptor` updated to use `environment.apiUrl || '/api/'`
- `attractions.search.*` i18n keys (`placeholder`, `backToAll`, `noResults`) added to all four locale files (en, de, fr, it)

### 2026-06-04 — Weather Feature Completed
- `WeatherService` created at `@shared/services/weather.ts`; `getWeather(lat, lon)` HTTP GET to `http://localhost:3000/api/v1/weather`, maps response through `buildForecastViewModel`
- `WeatherPayload` model updated to include optional `destination: Destination` for back-navigation; `ForecastViewModel` extended with `WeatherMeta` (elevation, timezoneAbbreviation); `buildForecastViewModel` now populates meta
- `Weather` component (`@shared/weather`) fetches on drawer payload change via `Subject` + `switchMap`; computes `todayMaxPrecipProb`, `todayAvgWind`, `globalTempMin/Max`, temp bar geometry (`tempBarLeft`, `tempBarWidth`), day formatting helpers
- Weather drawer UI: blue-gradient today card (condition, max/min temps, precip/wind/UV/precipitation stats row); 7-day overview list with precip%, icon, and proportional temp bar (CSS gradient blue→amber→red); day detail cards (2-up on ≥480px, single column on mobile) showing rain/wind/UV/daylight — today's card skipped as it duplicates the today summary
- `DestinationDetail` fetches weather on destination load via `WeatherService`; `.weather-box` shows today's condition label, icon, max temp, and "7 day forecast" link with shimmer skeleton while loading; clicking the link closes the destination drawer and opens the weather drawer
- DrawerHost: `Weather` component added; weather drawer uses `fa-solid fa-xmark` close icon, full-width on mobile (`min(600px, 100vw)`), header shows "Back to destination" + city name + "7-DAY FORECAST" label in a single left-aligned column; `onWeatherBack()` closes weather and reopens destination-detail using the destination stored in the payload
- `weather.*` i18n keys added to all four locale files (en, de, fr, it)
- Removed deprecated `{ allowSignalWrites: true }` option from `effect()` in `AllAttractions`

### 2026-06-03 — Attraction Detail Completed
- `AttractionDetail` fetches the full attraction via `AttractionsService.getAttraction(id, lang)` triggered by an effect on the drawer payload; `loading` signal shows a `p-skeleton` while in-flight
- Image gallery uses PrimeNG `p-galleria` with `circular` and `showItemNavigators`/`showThumbnails` (hidden when only one image); falls back to a single `photo` field if no `image` array; shows nothing if neither is present
- Switzerland Tourism link rendered from `attraction.url`; `description` rendered below the gallery when present
- Conditional detail fields shown in a `.detail-fields` block only when at least one has a value: `neededTime` and `wheelchairAccess` from the `classification` array, `spokenLanguages` from `availableLanguage` (2-letter codes mapped to full names via `LANG_NAMES`), `groupSize` from `event.audience`/`minimumAttendeeCapacity`/`maximumAttendeeCapacity`, `priceInfo` from `price.minPrice`
- Address block rendered only when `address` is a non-empty array; each entry shows name, street/postal/locality line, telephone, email, and URL
- Selected attraction marker highlighted in red (`#e53e3e`) with `.marker-selected` CSS class; `AttractionMarkersService.selectedId` signal drives this; `DestinationsLayout` computes `highlightedMarkers` by merging `selectedId` into the markers array with `highlight: true`; `AttractionDetail.ngOnDestroy` clears the selection
- `AttractionsService.getAttraction(id, lang)` single-attraction endpoint added; backend route and controller added to `myswitzerland.js`
- `attractions.detail.*` i18n keys (`neededTime`, `wheelchair`, `languages`, `groupSize`, `groupMin`, `groupMax`, `price`) added to all four locale files

### 2026-06-02 — Attraction List Completed
- `AttractionVerticalList` component renders top attractions inside `destination-detail` as cards (full-height photo left, name + abstract right); fetches with `top=true` and falls back to first 3 non-top if none returned; re-fetches on language change via `onLangChange` + `startWith`
- `AllAttractions` component rendered inside a `all-attractions` drawer (left, same width as destination-detail); infinite scroll via `IntersectionObserver` on a sentinel element; resets and re-fetches when destination changes or language changes
- `AttractionDetail` component rendered inside an `attraction-detail` drawer; payload carries the `Attraction`, the parent `Destination`, and the navigation `source` (`'destination-detail'` or `'all-attractions'`)
- Back navigation: destination-detail → all-attractions → attraction-detail, with correct reverse routing per `source`; `DrawerHost` owns all navigation handlers
- Collapse behaviour on `all-attractions` drawer: X button collapses (preserves payload); "Open attractions" reopen button appears on the map; `attraction-detail` X button fully closes (no reopen button)
- `AttractionMarkersService` (`@shared/services`) holds a single `markers` signal; `AttractionVerticalList` writes top-attraction markers; `AllAttractions` writes all-attraction markers (does not clear top markers before first page loads, so map stays populated during transition)
- Map markers use `fa-solid fa-circle-info` in `#1a2f4a` for all attraction types; destination marker removed (served no purpose)
- MapLibre clustering removed after review — max 119 attractions per destination makes individual markers sufficient; cluster source, layers, idle listener, and related fields all deleted from `MapComponent`
- `AttractionsService` split into two endpoints: `getTopAttractions` → `/topattractions` (with `top` param), `getAttractions` → `/attractions` (no `top` param, returns full dataset including top attractions)
- Backend: `getTopAttractions` and `getAttractions` controllers added to `myswitzerland.js`; routes registered at `/topattractions` and `/attractions` in `myswitzerland.js` router
- `DestinationsLayout` now re-fetches destination on language change via nested `onLangChange` + `startWith` inside the route-params `switchMap`, keeping destination name/abstract in sync
- `hasValidGeo()` utility extracted to `attraction-markers.ts` and shared by both `AttractionVerticalList` and `AllAttractions`
- `attractions.*` i18n keys added to all four locale files; `openDetail` key later removed when its reopen button was removed

### 2026-05-29 — Destination Detail & Map Page Completed
- `DestinationsLayout` uses `MapComponent` as a full-cover background (`position: fixed; inset: 0; z-index: 101`); map flies to destination coordinates on load (race-condition fix: `flyTo` called both in `ngOnChanges` and in the map `load` handler)
- `DestinationDetail` rendered inside a `DrawerHost`-managed PrimeNG `p-drawer` (position: left, `min(600px, calc(100vw - 20px))` wide); drawer opens automatically on navigation, expanded by default
- Drawer header: "Back to destinations" button (left) and × close button (right); navigation owned by `DrawerHost.onDestinationBack()`
- When drawer is closed an "Open destination" pill button appears on the map; `DestinationsLayout` caches the loaded destination and re-passes it as the drawer payload on reopen
- Drawer content: destination name, image gallery (PrimeNG Galleria), Switzerland Tourism link (`links.self`), abstract, action grid with "Plan a Trip" button (left) and weather placeholder (right)
- `MapComponent` `:host` changed to `position: absolute; inset: 0`; `destination-vertical-list .map-section` gained `position: relative` to match
- `header-nav` z-index bumped to 200 so it remains above the destinations layout (101) and footer-nav (100)
- `destinations.detail.open` i18n key added to all four locale files
- Collapse/expand partial-drawer logic fully removed from `DrawerService`, `DrawerHost`, and all call sites

### 2026-05-28 — Destinations Vertical List & Detail Completed
- `DestinationVerticalList` built with full-screen map hero (MapLibre, `app-map` shared component) and vertical card list below
- Cards show photo background, `cardTitle` pill, coordinates button (triggers `flyTo` on map), destination name, abstract (3-line clamp), and "Let's Visit" routerLink to `/destinations/:id`
- PrimeNG `SkeletonModule` used for loading state (6 placeholder cards)
- `MapComponent` shared component at `frontend/src/app/shared/map`; accepts `markers`, `zoom`, `center`, `activeMarker` inputs; handles marker sync and `flyTo` on active marker change
- `destinations.letsVisit` and `destinations.allCities.*` i18n keys added to all four locale files
- `/destinations/:id` route now resolves to `DestinationsLayout` (repurposed as the map+drawer shell)
- `DestinationsLayout` loads the destination by ID, centers the map on it, and controls a slide-in drawer
- Drawer slides up from bottom on mobile (max 70vh, rounded top corners), slides in from right on desktop (420px wide, full height) — pure CSS transition, no Angular animations module
- `DestinationDetail` rewritten as a presentational panel: `@Input() destination`, `@Output() close`; shows photo hero with name overlay, abstract, and external "Visit official page" link
- `DestinationsService.getDestination(id, language)` added for single-destination endpoint
- Home page now imports `DestinationHorizontalList` directly; `DestinationsLayout` freed for the detail route
- `destinations.detail.back` and `destinations.detail.visit` i18n keys added to all four locale files

### 2026-05-21 — Destinations Horizontal List Completed
- `Destination` and `DestinationsResponse` interfaces created at `frontend/src/app/models/destination.ts`
- `DestinationsService` created at `frontend/src/app/shared/services/destinations.ts`; HTTP GET to `/api/v1/myswitzerland/destinations` with params `language`, `page`, `hitsPerPage`, `facets`, `expand`, `translate`, `stripHtml`, `top`
- `destination-horizontal-list` component accepts inputs `cardTitle`, `title`, `subTitle`, `facet`, `viewAllRoute`; fetches on init and re-fetches on `onLangChange` via `switchMap`; subscription auto-cleaned with `takeUntilDestroyed`
- PrimeNG `SkeletonModule` used for loading state — 6 placeholder cards shown while data is in-flight
- `title` and `subTitle` inputs accept i18n keys, piped through `TranslatePipe` in template
- `cardTitle` rendered on a semi-transparent dark pill in the top-left corner of each card
- Horizontal scrollbar hidden on touch devices, shown as a thin 4px bar on hover/desktop (`@media (hover: hover)`)
- `destinations-layout` shell component wraps the list with `#f8fafc` background and `.container`; placed below the hero in `Home`
- `destinations.cityBreaks.*` and `destinations.viewAll` i18n keys added to all four locale files
- `View all` link routes to `/destinations` (`DestinationVerticalList`) registered as a child of `MainLayout`
- Hero height reduced to `500px` on mobile, restored to `700px` at `1024px`

### 2026-05-20 — Responsive Layout Completed
- Footer component hidden on screens 600px and above (mobile-only via media query)
- Hero title and subtitle font sizes doubled on screens 1024px and above
- `auth-layout` component converted to a side drawer using `DrawerService` (same pattern as `menu-nav`)
- `forgot-password` component converted to a side drawer using `DrawerService`

### 2026-04-16 — Initial Git Setup
- Initialized repository on `main` branch
- Removed nested `.git` folder from `frontend/` (was accidentally initialized as a separate repo)
- Re-added `frontend/` to the index as regular tracked files
- All project files staged and committed: backend, frontend (Angular), infra, context, and `.gitignore`

### 2026-04-23 — Top Navigation Menu Phase 1 Started
- Feature scoped: PrimeNG Menubar with custom template, brand left / hamburger right
- Side drawer activation deferred to Phase 2

### 2026-04-23 — Navigation Side Menu Started
- Feature scoped: wire up hamburger toggle to drawer-host/DrawerService, build side menu to match Toggle_menu.png

### 2026-04-23 — Navigation Side Menu Completed
- Hamburger button in header-nav wired to `DrawerService.toggle('menu-nav')`
- `DrawerHost` added to `main-layout`, manages all drawer overlays
- `menu-nav` built with NAVIGATION section (Home, Explore, Map Planner) and Log In button
- Visual styling matches `Toggle_menu.png` reference; icon borders removed, hover color `#dbeafe`

### 2026-04-23 — Top Navigation Menu Phase 1 Completed
- PrimeNG Menubar added to `frontend/src/app/shell/header-nav`
- Custom template with brand name 'ActivSwitzerland' on the left and hamburger toggle on the right
- Side drawer toggle activation remains deferred to Phase 2

### 2026-04-30 — Profile Page Completed
- Hero with initials avatar (amber circle), bold name and email; same gradient hero design as auth pages
- Three stat cards overlapping the hero (`margin-top: -20px`): Saved trips (`--navy-900`), Reviews written (`--color-green`), Reviews liked (`--amber-700`)
- Profile details card: view/edit toggle via separate Edit (`toggleEdit()`) and Save (`saveEdit()`) buttons
- Reactive form (`editForm`) with validation: firstName, lastName, country (required), email (required + email format)
- Red border on invalid-touched fields; Save button disabled (`opacity: 0.4`) until form is valid
- On save, `user` object updated from form values; on cancel (re-click Edit), form re-patches from current `user`
- Edit mode uses `formControlName` on InputText, Select (country with filter), ToggleSwitch (newsletter)
- Sign out button calls `auth.logout()` and navigates to `/auth`
- `--color-green` added to `styles.css`; `profile.*` i18n keys added to all four locale files
- Route `/auth/profile` protected by `authGuard`; user data hardcoded for layout phase

### 2026-04-30 — Forgot Password Wire-up Completed
- `AuthService.forgotPassword(email)` POST to `/api/v1/auth/forgotPassword`
- Success toast: "We have sent you a link to your email address to reset your password."
- Error status 500: "No user with the provided email was found."
- Any other error: "Oops something went wrong. Please try again."
- `ForgotPassword` component: injects `Auth`, `onSubmit()` calls `auth.forgotPassword()` with `submitting` signal; `(ngSubmit)` wired to `onSubmit()`

### 2026-04-30 — Forgot Password Page Completed
- `ForgotPassword` component routed at `/auth/forgot-password` (standalone, not inside `auth-layout`)
- Same hero design as auth-layout: blue gradient, amber circle with `fa-light fa-key`, translated title and subtitle
- Reactive form with `email` control (required + email format); red border on invalid touched state
- Email field: `--gray-50` fill, envelope icon, placeholder translated per locale
- "Reset Password" submit button (`--navy-900`), disabled until valid; shows "Sending…" while in flight
- "Back to log in" link routes to `/auth`
- `forgot.*` i18n keys added to all four locale files (en, de, fr, it)

### 2026-04-30 — Register Wire-up Completed
- `Country` interface (`alpha2Code`, `shortName`) created at `frontend/src/app/models/country.ts`
- `ReferenceData` service: `getCountries()` HTTP GET with `CountriesResponse` interface to unwrap `{ success, count, data }` envelope via `map(res => res.data)`
- `AuthService.register()` HTTP POST to `/api/v1/auth/register`; stores JWT, fires success toast, redirects to `/`
- `AuthService`: renamed interface to `AuthResponse`, extracted `storeToken()` helper shared by login and register
- `Register` component: loads `Country[]` via `ReferenceData` in `ngOnInit`; select uses `optionLabel/Value="shortName"`; `onSubmit()` calls `auth.register()`; `submitting` signal disables button during request

### 2026-04-30 — Register Page Completed
- Reactive form: `firstName`, `lastName` (required), `country` (required), `email` (required + email), `password` (required, min 8), `passwordCheck` (required + group match validator), `emailUpdates`
- First name / Last name rendered side by side in a flex row
- Country: PrimeNG `Select` with filter, checkmark, and globe icon
- Email: envelope icon, `your@email.com` placeholder
- Password / Verify password: padlock icon, eye toggle visible only when field has a value; red border on mismatch
- Newsletter: `ToggleSwitch` in a styled card with title and subtitle
- Create account button: `--navy-900` background, disabled (`opacity: 0.45`) until form is valid
- All inputs use `--gray-50` fill and CSS design token variables

### 2026-04-30 — Login Wire-up Completed
- `AuthService.login()` async method: HTTP POST to `http://localhost:3000/api/v1/auth/login`
- `token` signal initialised from `localStorage`; `isLoggedIn` computed from token presence
- Success toast (`toast-success` styleClass) and error toast (`toast-error` styleClass) via `ToastService`
- `tokenInterceptor` functional interceptor adds `Authorization: Bearer <token>` to outgoing requests
- `provideHttpClient(withInterceptors([tokenInterceptor]))` and `MessageService` added to `app.config.ts`
- PrimeNG `Toast` with custom message template (FA icons by severity, 300px, centered) added to `app.html`
- Login form wired: `onSubmit()` calls `AuthService.login()`, `submitting` signal disables button during request

### 2026-04-29 — Login Page Completed
- Reactive form with `email` (required + email validator) and `password` (required) controls
- Email field: envelope icon, `--gray-50` fill, placeholder `your@email.com`
- Password field: padlock icon, `--gray-50` fill, placeholder `Your password`, eye toggle shown only when field has a value
- Red border (`--color-error`) on touched invalid fields; submit button disabled (`opacity: 0.45`) until form is valid
- "Forgot password?" router link right-aligned below password field
- Log In button background `--navy-900`, hover `--navy-500`
- CSS custom properties (`--navy-*`, `--amber-*`, `--gray-*`, semantic) defined in `styles.css`
- All hex colour values replaced with variables across 7 component CSS files

### 2026-04-29 — Auth Layout Page Completed
- `AuthLayout` created as a separate layout from `MainLayout`, routed at `/auth`
- Hero section (200px) with blue gradient, amber lock icon circle (`#b45309`), title and subtitle
- Overlapping white card (-15px margin): gray pill tab bar toggling between `Login` and `Create account`
- `Login` and `Register` stub components conditionally rendered via `activeTab` signal
- Three benefit cards (white, 80px, 9px gap): bookmark, star, sparkles icons with amber colour
- Log In button in `menu-nav` updated to `routerLink="/auth"`
- `auth.*` i18n keys added to all four locale files (en, de, fr, it)

### 2026-04-29 — Footer Navigation Menu Completed
- `FooterNav` component built with five Font Awesome Light icons: Home, Explore, Map, Trips, Profile
- Fixed to bottom via `position: fixed`; added to `MainLayout` template and imports
- Active route (Home) styled `#b45309`; inactive icons `#0e3e6b`; hover shows circle background with white icon
- Only Home route wired (`/`); others stubbed (`/explore`, `/map`, `/trips`, `/profile`) for later
- Footer background `#dbeafe`; hover circle color `#0e3e6b`

### 2026-04-29 — Homepage Hero Section Completed
- `Home` component wired as default child route of `MainLayout`
- Hero section built with `hero.jpg` background, dark gradient overlay, responsive layout
- Content: badge, title, subtitle, CTA button (events deferred), and stats row (200+ Attractions, 26 Cantons, 13 UNESCO Sites)
- `src/assets` added to `angular.json` assets config so `hero.jpg` is served correctly
- Header nav set to `position: fixed` with `z-index: 100`
- Hero height set to 500px; badge and stats bar styled with `rgba(0,0,0,0.2)` background
- `hero.*` i18n keys added to all four locale files (en, de, fr, it)

### 2026-04-23 — Site Language Selection Completed
- PrimeNG `Select` added to bottom of `menu-nav`, pinned with flex column layout on `:host`
- Options: English (en, default), Deutsch (de), Français (fr), Italiano (it)
- Selection wired to `changeLanguage()` in `MenuNav`; language persisted to `localStorage`
- `zone.js` installed and added to polyfills in `angular.json`
- Populated `de.json` and `it.json` (were empty); all four locale files include `nav.*` and `nav-drawer.*` keys
- Fixed duplicate `TranslateService` initialisation — removed from `DrawerHost`, owned by `MenuNav`
