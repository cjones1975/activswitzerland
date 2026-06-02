# Current Feature

## Status

## Goals

## Notes

## History

<!-- Keep this updated. Earliest to latest -->

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
