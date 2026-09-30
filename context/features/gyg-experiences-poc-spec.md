# GetYourGuide "Experiences / Day trips" — Proof of Concept (Lauterbrunnen only)

## Overview

Evaluate GetYourGuide (GYG) affiliate activity widgets inside the destination-detail drawer before
committing to a full rollout across the mapped destinations. The GYG Partner API (which would let us
render our own cards) is not available yet because of its traffic threshold, so the only option today
is GYG's embeddable **activities widget**. It renders inside a GYG-controlled iframe, so we get no
control over its styling. That's the main unknown this POC answers: **how it looks and performs in our
drawers on mobile and desktop**.

Scope is deliberately limited to **one destination: Lauterbrunnen** (MySwitzerland identifier
`b92e2cfa-0216-4832-b38e-8fadb29d3b04`, GYG location ID `2863`).

## Goals (what we want to learn)

1. Does the widget render correctly when inserted dynamically into an Angular drawer (SPA), rather than
   being present in the HTML at page load? (See "Technical risk" below.)
2. How does it look inside the destination-detail drawer at ~400px mobile width and in the desktop
   split view?
3. How long does it take to load, and does it slow down opening the drawer?
4. Does switching the app language re-render the widget in the new locale?
5. Are affiliate clicks attributed to our partner ID (visible in the GYG partner dashboard)?

Outcome: a go / no-go decision for a full rollout (see "After the POC").

## Current state (verified in code)

- `destination-detail` activity cards: `frontend/src/app/features/destinations/destination-detail/destination-detail.html:36-54`.
  Hotels card is gated on `hasHotelMapping()` (`destination-detail.ts:43`).
- The `hotels` drawer is the pattern to follow for a new drawer opened from destination-detail:
  `drawer-host.html:456-487` (left-positioned `p-drawer`, back button to the destination, plain X close,
  body wrapped in `@if (svc.isOpen('hotels'))`) and `drawer-host.ts:386-395`
  (`onHotelsBack()` / `hotelsDestinationName()`).
- `DrawerKey` union: `frontend/src/app/shared/services/drawer.ts:3-20`.
- Supported app languages: `SUPPORTED_LANGS = ['en', 'de', 'fr', 'it', 'es']`
  (`frontend/src/app/shared/services/lang.ts:4`). Components react to language changes via
  `TranslateService.onLangChange` (e.g. `destination-vertical-list.ts:43`).
- The app is server-side rendered (`i18n-loader.ts` has an SSR branch). Third-party browser scripts
  must not run on the server.
- No cookie-consent banner is implemented yet (`cookie-consent-matomo-spec.md` exists, but there is no
  service in `shared/services/`).
- Lauterbrunnen is already in `backend/src/data/hotelDestinations.json:33`.

## Technical risk: does the widget render when added dynamically?

GYG's loader script (`https://widget.getyourguide.com/dist/pa.umd.production.min.js`) was inspected:
it finds widget elements with `querySelectorAll` and marks each processed element with a
`data-gyg-scraped` attribute. **No `MutationObserver` or public "re-scan" function was found.** Our
widget containers appear only when a drawer opens (after the script has loaded), so the script might
not pick them up.

**Step 1 of implementation is to verify this before building the rest.** Try in this order and keep
the first approach that works:

1. **Load the script after the container is in the DOM.** On first use, insert the container, then
   inject the script. Check whether a *second* container (the "See more" drawer, or re-opening the
   drawer) also renders.
2. **Re-inject the script** each time a new container is inserted (remove the existing `<script>` tag
   and append a fresh one). Check the console for errors and for duplicate tracking requests.
3. **Fallback: render the iframe directly.** The widget's content comes from
   `https://widget.getyourguide.com/default/activities.frame`. Build that iframe `src` ourselves with
   the same parameters. The exact query parameter names must be taken from what the script generates
   (inspect the iframe it creates in approach 1). With this approach, the iframe won't resize itself to
   fit its content (the script normally handles that), so we'd need a fixed height or our own
   `postMessage` listener.

Record which approach was used, and why, in the History section of `current-feature.md` when asked.

**Resolved by further inspection (implementation):** `pa.umd.production.min.js` only handles
analytics. It injects `https://widget.getyourguide.com/pw/latest/client-loader/widget.js`, which does
the actual rendering. `widget.js` runs a `MutationObserver` on `document.body` (`childList`, `subtree`)
and renders any newly added `[data-gyg-widget]` element, after a 100ms debounce. Our drawers are
appended to `body`, so **approach 1 works on its own**, with no re-scan or re-inject needed. (Approach 2
wouldn't have worked anyway: the loader refuses to run twice via `window.gygPAStatus`.) `widget.js` also
exposes `window.GYG.refresh()`, which isn't needed here. A language change swaps in a fresh container
element, and the observer renders it. The browser checks below still confirm this in practice.

Other findings from `widget.js`, for the post-POC privacy review:
- If the GYG account has a server-side flag (`scm`) set, it sends up to 8,000 characters of the page's
  `main`/`article`/`[class*=content]` text to GYG.
- Auto-insertion of extra widgets only happens with `data-gyg-global-auto-insert`, which we don't set.
- GYG's scripts contain `localhost` host exclusions in their analytics paths, so partner click
  attribution should be checked on a deployed host, not locally. Widget rendering itself isn't
  affected.

## Requirements

### 1. Config

- `frontend/src/environments/environment.ts` and `environment.prod.ts`: add `gygPartnerId: '<ID>'`.
  The partner ID is public (it appears in the page markup anyway), so it doesn't need to go through
  the backend. **The real ID is needed from the user before implementation.**
- POC location mapping as a **frontend constant**, not a database field:

  ```ts
  // POC only — replaced by a `gygLocationId` field on HotelDestination if the POC is a go.
  export const GYG_LOCATIONS: Record<string, number> = {
    'b92e2cfa-0216-4832-b38e-8fadb29d3b04': 2863, // Lauterbrunnen
  };
  ```

  Rationale: this avoids a schema change and a manual Mongo re-import for something that may be
  thrown away. If the POC is a go, the rollout moves this to the table (see "After the POC").

### 2. `GygService` — `frontend/src/app/shared/services/gyg.ts` (new)

- `locationIdFor(identifier: string): number | undefined` reads `GYG_LOCATIONS`.
- `localeFor(lang: Lang): string` maps app language to a GYG locale code:

  | App | GYG locale |
  |-----|------------|
  | en  | `en-GB`    |
  | de  | `de-CH`    |
  | fr  | `fr-CH`    |
  | it  | `it-CH`    |
  | es  | `es-ES`    |

  Swiss variants are the first choice. If GYG doesn't support one (the widget renders in English or
  errors), fall back to `de-DE` / `fr-FR` / `it-IT` and note it.
- `ensureScript(): Promise<void>` injects the loader script **once, in the browser only**
  (`isPlatformBrowser` guard), with `async`, `defer` and `data-gyg-partner-id`, and resolves on load.
  **No script tag in `index.html`**, so pages without a widget never load GYG code. (The details depend
  on which approach from "Technical risk" wins.)

### 3. `GygActivities` widget component — `frontend/src/app/features/experiences/gyg-activities/` (new)

- Standalone component, selector `app-gyg-activities`, inputs `locationId: number` and
  `numberOfItems: number`.
- Browser only: renders nothing during SSR, and builds the widget in `afterNextRender`.
- Builds the container element in code (not in the template), so the script works on a clean element
  every time:

  ```html
  <div data-gyg-widget="activities"
       data-gyg-href="https://widget.getyourguide.com/default/activities.frame"
       data-gyg-partner-id="{gygPartnerId}"
       data-gyg-location-id="{locationId}"
       data-gyg-locale-code="{localeFor(currentLang)}"
       data-gyg-currency="CHF"
       data-gyg-number-of-items="{numberOfItems}">
  </div>
  ```

  `data-gyg-q` is **not** used. The location ID is more precise, and "Experiences & Day trips" is our
  UI label, not a search term.
- **Language change**: on `onLangChange`, remove the container and rebuild it with the new locale
  (plus a re-scan or re-inject, depending on the approach that won).
- Below the widget, a small attribution line: "Powered by
  [GetYourGuide](https://www.getyourguide.com/-l2863/?partner_id={gygPartnerId})" opening in a new tab,
  with `rel="sponsored noopener"`. Build the URL from the location ID. Check during the POC that the
  short `-l{id}` URL redirects correctly. If it doesn't, add a per-location URL slug to the constant.
- While loading: a skeleton block of fixed height (reuse the look of `.weather-skeleton`) so the drawer
  doesn't jump when the iframe appears.

### 4. destination-detail: "Experiences / Day trips" section

- `destination-detail.ts`: `gygLocationId = computed(() => this.gygSvc.locationIdFor(this.destination()?.identifier ?? ''))`.
- `destination-detail.html`: when `gygLocationId()` is set, add a section **after the weather box,
  before the nearby-attractions list**:
  - Heading: `destinations.detail.experiences` ("Experiences / Day trips").
  - `<app-gyg-activities [locationId]="id" [numberOfItems]="6" />`.
  - A "See more" link button (`destinations.detail.experiencesSeeMore`) that calls `openExperiences()`.
- `openExperiences()` follows `openHotels()`: close `destination-detail`, then
  `drawerSvc.open('experiences', { destination: dest })`. It does not call `activityMap.showOnly`,
  because there are no map markers for experiences.
- Where to place it is easy to change after seeing it. Placing it after the attractions list is the
  alternative if it turns out to push useful content too far down.

### 5. New `experiences` drawer

- `drawer.ts`: add `'experiences'` to `DrawerKey`.
- `drawer-host.html`: new `p-drawer` block copied from the `hotels` block (same width, position,
  modal/desktop behaviour, `styleClass="dest-drawer experiences-drawer"`):
  - Header: back button `attractions.backToDestination` with the destination name, and an X that just
    closes the drawer (`onDrawerClose('experiences')`, no reopening of a parent drawer).
  - Body, inside `@if (svc.isOpen('experiences'))`: heading `destinations.detail.experiences` plus
    `<app-gyg-activities [locationId]="…" [numberOfItems]="30" />`.
- `drawer-host.ts`: `onExperiencesBack()` / `experiencesDestinationName()` / `experiencesLocationId()`,
  mirroring the hotels ones.

### 6. i18n

New keys under `destinations.detail`, in **all five** locale files (en/de/fr/it/es):

| Key | en |
|-----|----|
| `experiences` | Experiences / Day trips |
| `experiencesSeeMore` | See more |

### 7. Revision after first look: reduce the widget's prominence

The first version gave the GYG widget more visual weight than our own MySwitzerland attractions, and
its activities have no map pins, which could confuse users. Changes:

- **Placement and count:** the section moves **below** `app-attraction-vertical-list` and shows
  **3** items instead of 6. The drawer still shows 30.
- **Lazy load:** `GygActivities` builds nothing (no script, no iframe) until it comes within 300px of
  its scroll container, detected with an `IntersectionObserver` rooted on the nearest scrolling
  ancestor.
- **Distinct panel:** the destination-detail section is a rounded panel with a `#f8c182` background
  and a `#d97706` border, setting it apart from the gray attraction cards. (A pale amber tint and then
  `#f7f9fa` were tried first; the user settled on these colours.) The panel's side padding is 0.5rem,
  and the Experiences drawer body has no side padding of its own beyond PrimeNG's, to give the GYG
  iframe as much width as possible. A partner subtitle `destinations.detail.experiencesPartner` ("Bookable tours from our partner
  GetYourGuide") appears under the heading, in both the section and the drawer.
- **Map pin on attraction cards:** each card in `attraction-vertical-list` shows the attraction marker
  image (`/assets/attraction.png`, the same file the map pin uses) before its name, tying the cards to
  the pins. The GYG items have no pin.
- **Clearing map pins on "See more":** `openExperiences()` calls
  `activityMap.showOnly('experiences')` (new `ActivityMapCategory` value), which wipes the attraction
  markers, as `openHotels()` does. Back to destination-detail repopulates them via the attractions
  list.

## Out of scope (POC)

- Any destination other than Lauterbrunnen.
- Database / schema changes (`gygLocationId` on `HotelDestination`).
- Cookie consent. The loader script also scans every link on the page, including links to competitors
  (Viator, Tiqets, Musement, Civitatis), and sends click-tracking events to GYG.
- Privacy policy update.
- Restyling widget content (not possible because of the iframe).

## Evaluation checklist (user verifies in browser)

- [ ] Widget renders in destination-detail on first open, and again after closing and reopening.
- [ ] "See more" drawer renders 30 items, and Back returns to Lauterbrunnen with its widget rendering.
- [ ] Language switch re-renders in the new locale; each Swiss locale is accepted or has a fallback.
- [ ] Mobile (~400px): readable layout, no horizontal scroll, iframe height fits content.
- [ ] Desktop split view: acceptable layout.
- [ ] Load time: drawer opens without delay; note the time until the widget appears.
- [ ] No SSR errors and no console errors.
- [ ] Clicking an activity opens GYG in a new tab; the click shows up in the GYG partner dashboard
      (may take time).
- [ ] Other destinations (e.g. Mürren) show no Experiences section.

## After the POC (if go, separate spec)

- Move the location ID to an optional `gygLocationId` field on `HotelDestination` (seed JSON + model +
  frontend interface), and gate on that field being set, independently of the Booking.com gate.
- Collect GYG location IDs for the other mapped destinations.
- Update the privacy policy (GYG as a third party) before, or together with, merging to `main`. Revisit
  cookie consent.
- Look at loading the widget only when the section scrolls into view, if load time is a problem.
