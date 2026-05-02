# Current Feature

None

## Status

—

## Goals

—

## Notes

—

## History

<!-- Keep this updated. Earliest to latest -->

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
