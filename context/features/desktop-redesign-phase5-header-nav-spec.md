# Desktop Redesign Phase 5: Horizontal Header Nav

Independent track of `context/features/desktop-responsive-redesign-spec.md` (master plan) — doesn't
depend on Phases 0-4. New branch: `feature/desktop-header-nav`.

## Why now, out of phase order

User wants to work through existing functionality bit by bit fixing things that look/feel wrong on
desktop, rather than waiting for phases 2-4 to land first. This is the master plan's Phase 5 pulled
forward: "no desktop nav bar exists at all — all nav links live inside the 300px-wide `menu-nav`
drawer," reached via a hamburger button at *every* screen width today.

## Scope

`frontend/src/app/shell/header-nav/` gets a horizontal nav row + profile control at desktop width;
`menu-nav` (the drawer) is untouched and keeps serving mobile/tablet exactly as today, still reached
via the hamburger. No map/drawer split-view work (that's Phases 0-4) — this is header chrome only.

## Confirmed decisions (from AskUserQuestion)

- **Breakpoint: reuse `Breakpoint.isDesktopSplitView` (1280px/`xl`), not a new one.** Keeps a single
  "desktop" cutoff across the app instead of adding a second ad-hoc breakpoint — the exact
  inconsistency the original redesign audit flagged (480-1100px values found scattered across
  components). Real users won't see this change yet regardless, since
  [[project_desktop_mobile_notice]] gates everything ≥1024px behind the "use mobile" page; only
  `?preview=desktop` sees it until that notice is retired.
- **Secondary items go in a profile-icon dropdown, not inline.** Header bar at desktop shows: brand,
  the 4 primary nav links (Home, Search, Trip Planner, Explore Trips) inline, then AI-chat button,
  then a profile icon button. Clicking the profile icon opens a `p-popover` containing: login/logout,
  language switcher, and terms/privacy links — i.e. everything `menu-nav` has *except* the primary nav
  section, which moves inline. Keeps the header bar itself uncluttered instead of cramming a language
  dropdown + auth button + legal links directly into the bar.

## Implementation

- `header-nav.html`/`header-nav.ts`: nav-links row (Home, Search, Trip Planner with the same
  `queryParams: { from: router.url }` menu-nav uses, Explore Trips), `routerLinkActive` for
  current-page highlighting. Rendered as a sibling of `<p-menubar>`, not inside its `#start` slot —
  centered on request, and true centering (independent of the brand's and the action icons' widths,
  which differ) isn't achievable from inside `p-menubar-start` since that region only ever gets the
  leftover width after `p-menubar-end`, not a share of the header centered on the whole bar.
  Absolutely positioned against `:host` instead (`top/left: 50%` + `translate(-50%, -50%)`) —
  `:host` is already the `position: fixed` full-width header strip, so this centers on the header as
  a whole regardless of what's on either side.
- Profile icon button + `p-popover` panel (new, PrimeNG `Popover` component — not currently used
  elsewhere in the app but available in the installed PrimeNG build) reusing `Auth`/`LangService`
  exactly as `menu-nav.ts` does today (`onAuthAction`, `onProfileClick`, `changeLanguage`) — same
  behavior, duplicated in `header-nav.ts` rather than shared, since the two components' surrounding
  context (popover vs. drawer, close-on-click semantics) differs enough that extracting a shared
  helper isn't worth it for ~15 lines. Visible only at/above 1280px.
- Hamburger toggle button: hidden at/above 1280px, unchanged below it. `menu-nav`'s own
  content/behavior is not touched — still has all 5 items (including Profile) for the sub-1280 case.
- `header-nav.css`'s portalled popover content (`.profile-menu*` classes) lives in global
  `frontend/src/styles.css` instead, matching the existing `.day-select-panel`/`.leg-datetime-panel`
  precedent for `appendTo`-portalled PrimeNG panels — component-scoped styles can't reach content
  PrimeNG renders straight onto `<body>`.

## Bug found and fixed: Tailwind responsive utilities silently no-op against this file's plain CSS

Tried the master plan's stated approach first — `hidden xl:flex` / `xl:hidden` Tailwind utilities on
the nav row, profile button, and hamburger button. Built cleanly, but at 1600px the hamburger stayed
visible alongside the new nav (confirmed via screenshot, then fixed).

**Root cause**: Tailwind v4's `@import 'tailwindcss'` (only present in the global `styles.css`) wraps
every utility in a CSS `@layer`. `header-nav.css` is a normal Angular component stylesheet — it isn't
part of any layer. Per the CSS cascade-layers spec, *any* unlayered rule beats *any* layered rule of
any specificity, regardless of source order. `.toggle-btn { display: inline-flex }` (unlayered,
already existed in this file) therefore always won over `.xl:hidden`'s layered `display: none`, no
matter the viewport width.

**Fix**: dropped the Tailwind utility classes here and used a plain `@media (min-width: 1280px)`
block in `header-nav.css` instead — same 1280px cutover, just expressed as vanilla CSS so it can
actually contend with the file's existing rules. A second, smaller bug surfaced fixing this: the
first attempt used bare `.profile-btn`/`.hamburger-btn` selectors, which are equal-specificity with
`.toggle-btn` and so still lost to it depending on which rule happened to sit later in the file.
Fixed by using compound selectors (`.toggle-btn.profile-btn`, `.toggle-btn.hamburger-btn`) so they
always out-specificity the plain `.toggle-btn` rule regardless of source order.

**Implication for later phases**: any component that already has hand-rolled CSS and wants to add
Tailwind-utility responsive behavior on the *same elements* needs to either migrate that component's
existing rules into Tailwind's layers too, or keep using plain `@media` for that component — a bare
Tailwind utility class next to legacy component CSS is not reliable. Worth flagging explicitly in
Phase 3/4 (the other phases planning to lean on Tailwind utilities) rather than rediscovering this
per-component.

## Verified live (2026-09-03)

Screenshot-checked at 1600px (`?preview=desktop`) and 800px against a real dev server:
- 1600px: brand, 4 nav links (current page shown bold), Ask-AI button, profile icon — no hamburger.
  Profile icon opens the popover (Log In, language selector, terms/privacy links, all functional).
  Clicking "Trip Planner" navigates and correctly bolds that link.
- 800px: unchanged from before this phase — Ask-AI button + hamburger only, no profile icon, no nav
  row.
- No console errors on either width.

## Verification (user to run live in-browser)

- At ≥1280px (`?preview=desktop`): header shows brand, 4 nav links, AI-chat button, profile icon — no
  hamburger. Profile icon opens popover with login/logout, language switcher, terms/privacy links,
  all functioning identically to today's drawer versions. Nav links navigate correctly, current page
  highlighted.
- Below 1280px: header unchanged — hamburger opens `menu-nav` drawer exactly as before, all 5 items
  present including Profile.
- Resize across the 1280px boundary: no layout jump/overlap, only one of (nav row + profile icon) vs.
  (hamburger) visible at a time.

## References

- @context/features/desktop-responsive-redesign-spec.md (master plan, Phase 5 section)
- @context/features/desktop-mobile-notice-spec.md
- @frontend/src/app/shell/header-nav/, shell/menu-nav/
- @frontend/src/app/shared/services/breakpoint.ts
- @frontend/src/app/core/services/auth.ts, shared/services/lang.ts
