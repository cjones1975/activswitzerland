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
