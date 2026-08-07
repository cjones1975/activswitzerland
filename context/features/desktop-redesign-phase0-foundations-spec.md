# Desktop Redesign Phase 0: Split-View Foundations

Phase 0 of `context/features/desktop-responsive-redesign-spec.md` — see that doc for full context/
rationale. This spec covers the first concrete slice: the split-view sidebar *mechanism* itself,
proven on one drawer (`destination-detail`) before Phase 1 rolls the pattern out everywhere else.
Not in this slice: the shared page-container convention and `shared/components/` primitives listed
in the master spec's Phase 0 section — deferred until a real second consumer (Phase 1/3) makes their
shape clearer, per [[feedback_spec_branch_workflow]]-adjacent "don't build for hypothetical future
requirements."

## Resolved decisions for this slice

- **Split-view breakpoint: 1280px.** Matches Tailwind v4's built-in `xl` breakpoint exactly (no
  `@theme` override needed — confirmed no `@theme` block or Tailwind config exists today, so the
  framework defaults already apply). `SPLIT_VIEW_MIN_WIDTH = 1280` in the new `Breakpoint` service is
  the single source of truth; future Tailwind layout work should reach for `xl:` and it'll line up.
- **Mechanism: toggle PrimeNG `p-drawer`'s `[modal]` input, not a rebuilt flex layout.** Read
  `node_modules/primeng/fesm2022/primeng-drawer.mjs` directly (`enableModality()`/`show()`, ~line
  408-451): the scrim/mask `<div>` is only ever created and appended to `<body>` `if (this.modal)` —
  with `modal=false` there is no mask element at all, so nothing intercepts pointer events outside
  the drawer panel's own bounds. The panel itself is a plain `position: fixed` element sized by its
  existing `[style]` width — so simply binding `[modal]="!breakpoint.isDesktopSplitView()"` turns
  today's overlay drawer into a genuinely non-modal docked panel with **zero layout rebuild**: the
  map underneath (already `position: fixed; inset: 0` in `destinations-layout.css`) stays exactly
  where it is and is immediately clickable everywhere the panel doesn't cover. This avoids the
  flex-split-pane approach originally sketched in the master spec, which would have required
  restructuring `destinations-layout` and every drawer-hosting shell — the modal-toggle gets the same
  user-facing result (sidebar + map both interactive, no scrim, no collapse-to-reach) for far less
  code, and is the pattern Phase 1 should reuse for the other drawers.
- **Docking position: below the header, not covering it.** `header-nav` is `position: fixed; z-index:
  200`; drawers render at `z-index >= 4000` (`Drawer.zIndexFor()`), so today's mobile overlay drawer
  visually covers the header while open. At desktop the docked panel gets `top: 4.5rem` (matching the
  existing `.reopen-btns` clearance value already used in `destinations-layout.css` for "below the
  header" positioning — reusing the established convention rather than a new magic number) and
  `height: calc(100% - 4.5rem)`, so the header (and its future desktop nav, Phase 5) stays reachable.
- **Width: unchanged.** `destination-detail` already renders at `min(600px, calc(100vw - 20px))`,
  which evaluates to a flat 600px at any desktop viewport — already within the master spec's proposed
  desktop sidebar range. No width change in this slice.
- **The map visibly reflows, not just becomes clickable underneath.** First pass only removed the
  modal scrim (panel still floated over the same full-bleed map, functionally non-modal but visually
  indistinguishable from a normal overlay drawer) — live-tested by the user, who expected a genuine
  docked-beside-the-map look per the master spec's "Airbnb/Google-Maps style" framing. Corrected:
  `destinations-layout`'s own map container now shifts its left edge by the same 600px when the panel
  is docked, so the map's visible area shrinks to make room rather than sitting hidden behind the
  panel. MapLibre GL doesn't watch its container for size changes on its own, so a `ResizeObserver` on
  the map container (`shared/map/map.ts`) now calls `map.resize()` whenever it fires — needed because
  this resize is driven by a CSS class toggle, not an `@Input` change, so `ngOnChanges` never sees it.
- **Scope: `destination-detail` only.** `all-attractions`/`attraction-detail`/`hikes`/`hike-detail`/
  `bikes`/`bike-detail`/`weather`/`connections` keep today's mobile-overlay behavior at every width
  for now — converting them is Phase 1, once this mechanism has been reviewed live.

## Implementation

- New `frontend/src/app/shared/services/breakpoint.ts` — `Breakpoint` service, `SPLIT_VIEW_MIN_WIDTH
  = 1280` constant, `isDesktopSplitView` signal synced from `window.matchMedia`. Guarded with
  `isPlatformBrowser(inject(PLATFORM_ID))` (this app is SSR — `core/services/auth.ts`/
  `shared/services/lang.ts`/`shared/map/map.ts` all needed the same guard historically for direct
  `window`/`localStorage` access under Node prerendering, see `current-feature.md`'s 2026-07-31 SEO
  SSR history entry). Defaults `false` server-side, so SSR always renders the mobile/overlay markup;
  the client corrects to the real viewport once `matchMedia` runs post-hydration.
- `frontend/src/app/shared/drawer-host/drawer-host.ts`: inject `Breakpoint` as `protected breakpoint`.
- `frontend/src/app/shared/drawer-host/drawer-host.html`: `destination-detail` `p-drawer` gains
  `[modal]="!breakpoint.isDesktopSplitView()"`. No other attribute changes — `closable`/`dismissible`/
  `closeOnEscape` behavior stays as today at every width.
- `frontend/src/app/shared/drawer-host/drawer-host.css`: new `@media (min-width: 1280px)` block,
  `::ng-deep .dest-detail-drawer { top: 4.5rem !important; height: calc(100% - 4.5rem) !important;
  box-shadow: none !important; border-inline-end: 1px solid var(--gray-200) !important; }` — mirrors
  the existing `::ng-deep .dest-detail-drawer { width: 100vw !important }` mobile override already in
  this file (same selector, same `::ng-deep`-into-portalled-PrimeNG-markup technique, just the
  opposite end of the viewport range). `!important` matches the existing convention in this file for
  overriding PrimeNG's own `.p-drawer-left` positioning rules.

- `frontend/src/app/shell/destinations-layout/destinations-layout.ts`: injects `Breakpoint`; new
  `sidebarDocked` computed (`breakpoint.isDesktopSplitView() && drawer.isOpen('destination-detail')`).
- `frontend/src/app/shell/destinations-layout/destinations-layout.html`: `.map-wrapper` and
  `.reopen-btns` both bind `[class.X--docked]="sidebarDocked()"`.
- `frontend/src/app/shell/destinations-layout/destinations-layout.css`: `.map-wrapper--docked { left:
  600px }` (matches the panel's effective width), `.reopen-btns--docked { left: calc(600px + 1rem) }`
  so the reopen buttons don't render under the docked panel; both wrappers gain a `transition: left
  0.2s ease` so the shift animates alongside the panel's own slide.
- `frontend/src/app/shared/map/map.ts`: new `ResizeObserver` on `mapContainer.nativeElement`
  (set up in `ngAfterViewInit`, `.disconnect()`ed in `ngOnDestroy`), calling `map.resize()` on any
  container size change — generic, not specific to this feature, so it also covers any other future
  case where a map's container changes size outside of an `@Input`.

## Out of scope (this slice)

- Shared page-container convention, `shared/components/` primitives — master spec's Phase 0 items,
  deferred (see above).
- Every other drawer (Phase 1).
- Trip planner wizard internals (Phase 2), content-page grids incl. the homepage destination cards
  (Phase 3), shared component library (Phase 4), global desktop nav (Phase 5).
- The `Drawer` service's stacking behavior when multiple drawers are open — not exercised by this
  slice since only one drawer (`destination-detail`) changes behavior.

## Bug found and fixed: mobile regression from the header-seam fix

The `top: 4.5rem` fix above (and its `trip-planner-layout.css` twin) was applied as the *base* rule —
i.e. unconditionally, at every viewport width — when it should only ever have applied at desktop. On
mobile this pushed `.map-wrapper`'s box 72px down at every width, leaving an empty navy gap between
the header and the actual map (with the reopen-button and any markers positioned in that same
72px-down coordinate space, appearing stranded in the empty area above where map tiles rendered).
Mobile had no such problem before this fix — found via a live mobile screenshot after the fact. Fixed
by moving `top: 4.5rem` into a `@media (min-width: 1280px)` block in both `destinations-layout.css`
and `trip-planner-layout.css`, restoring `inset: 0` (the original, pre-this-session value) as the
unconditional base rule. `.map-wrapper--docked`'s `left` shift and `.tp-wizard-host--docked`'s own
`top: 4.5rem` were never affected — both are already gated by a JS-computed class bound to
`breakpoint.isDesktopSplitView()`, not a bare CSS media query, so they only ever applied at desktop
to begin with.

## Verification (user to run live in-browser)

- At ≥1280px viewport width, open a destination detail page: the panel docks left, below the header,
  no dark scrim, and the **map visibly shrinks to sit beside it** (not hidden underneath) — pan/zoom
  the map and click a marker while the panel is open, no need to close it first. The map's own zoom
  control (bottom-right) should reposition to the new, narrower map area, not stay where the old
  full-width map's bottom-right used to be.
- The panel's own back-chevron (returns to `/destinations`) and "show on map" icon (closes the panel,
  full map) still work exactly as before.
- Narrow the viewport below 1280px (or load on a phone-width viewport): behavior is pixel-for-pixel
  identical to before this change — full-screen modal overlay with scrim, no docking.
- Resize the window across the 1280px boundary while the panel is open: it should switch between
  docked/overlay live (the `matchMedia` listener), not just on next navigation.
- Every other drawer opened from a destination page (Attractions, Hikes, Bikes, Weather) — confirm
  unaffected, still full mobile-style overlay behavior even at 1920px (expected — out of scope here,
  Phase 1).

## References

- @context/features/desktop-responsive-redesign-spec.md (master plan)
- @frontend/node_modules/primeng/fesm2022/primeng-drawer.mjs (`enableModality`/`show`, confirms the
  `modal` mechanism)
- @frontend/src/app/shell/destinations-layout/destinations-layout.css (`.reopen-btns` `top: 4.5rem`
  convention being reused)
- @frontend/src/app/shell/header-nav/header-nav.css (`z-index: 200`, fixed, height driver for the
  `4.5rem` clearance)
- @frontend/src/app/shared/drawer-host/drawer-host.html, drawer-host.ts, drawer-host.css
- @frontend/src/app/shared/services/drawer.ts
