# Mobile Bottom Sheets: Grab Handle Instead of Expand/Collapse Carets

## Overview

Follow-up to `mobile-drawer-bottom-sheet-spec.md`. The seven mobile bottom sheets currently expand /
collapse via a `fa-square-caret-up`/`-down` button sitting left of the X. Replace it with the
familiar bottom-sheet "grab handle" (Google Maps, Apple Maps, etc.): a short rounded horizontal bar,
centred at the top edge of the sheet, that can be tapped **or** swiped.

## Scope

Same seven drawers, mobile-sheet branch only (`xMobileSheet()` true):

- `destination-detail`
- `all-attractions`, `attraction-detail`
- `hikes`, `hike-detail`
- `bikes`, `bike-detail`

Tablet/desktop headers and trip-planner-mode headers (`@else` branches) are untouched.

## Confirmed decisions

- **CSS bar, not an icon**: ~36×5px rounded pill (`--gray-300`-ish), not `fa-minus`. Rendered inside
  a `<button>` with a larger invisible hit area so it's easy to grab.
- **Position**: horizontally centred, just below the sheet's top edge — absolutely positioned against
  the sheet itself, independent of the header row's padding / the X button.
- **Caret button removed**; X stays on the right of the header row, still a plain `onDrawerClose(key)`.
- **Tap** toggles expanded/collapsed (today's behavior, unchanged).
- **Swipe** on the handle: up past a small threshold → expand, down → collapse. Snap-on-release
  between the existing two heights (`50dvh` / `calc(100dvh - var(--header-h))`); the sheet does not
  track the finger live during the drag (kept out to avoid complexity — possible later polish).
  Swipe down when already collapsed does nothing (does **not** close the sheet — X is the only close).
- **Keyboard**: button still responds to Enter/Space via `click`; aria-label stays `nav.expand` /
  `nav.collapse`. No new i18n keys.
- `touch-action: none` on the handle so the swipe isn't eaten by page scroll / pull-to-refresh.

## Implementation

- `drawer-host.ts`: pointer handlers `onSheetHandlePointerDown/Up` (record start Y with pointer
  capture; on release, if |dy| ≥ threshold set expanded accordingly and suppress the following
  click); `onSheetHandleClick()` toggles unless suppressed.
- `drawer-host.html`: in all seven `dest-header--sheet` blocks, replace the caret button with the
  handle button.
- `drawer-host.css`: `.sheet-handle` (absolute, centred, top of sheet) + `::before` pill; header row
  keeps the X right-aligned.

## References

- @frontend/src/app/shared/drawer-host/drawer-host.html, drawer-host.css, drawer-host.ts
- @context/features/mobile-drawer-bottom-sheet-spec.md

## Status

**Implemented** on branch `feature/sheet-grab-handle`. Swipe threshold is 20px. Build clean
(`ng build`, only the pre-existing CSS budget warnings); not yet verified in-browser.
