# Desktop "use mobile for now" notice

While the desktop responsive redesign (`context/features/desktop-responsive-redesign-spec.md` and its
phase specs) is still in progress, real desktop visitors get a static notice directing them to mobile
instead of the partially-finished desktop layout. The mobile experience is unaffected.

## Trigger

Gated on viewport width, not route — replaces the entire app (not an overlay) so nothing behind it
mounts. New `Breakpoint.isDesktopNotice` signal (`shared/services/breakpoint.ts`), same
matchMedia/SSR-safe pattern as the existing `isDesktopSplitView` signal:

- **Cutoff: `DESKTOP_NOTICE_MIN_WIDTH = 1024px`.** Deliberately not the same as
  `SPLIT_VIEW_MIN_WIDTH` (1280px, used elsewhere for split-view drawer layout) — 1024px is where the
  phase3 tablet-tier grid work already shipped stops being "good enough" to show real users. Below
  1024px (including the 768-1023px tablet tier), the current app keeps rendering as-is.
- **SSR unaffected**: like `isDesktopSplitView`, the signal always defaults `false` on the server (no
  `window`), so SSR/prerender output is always the real app. Bots — including Googlebot, which crawls
  mobile-first by default — see real content, not the notice.
- **Dev bypass**: `?preview=desktop` on any URL sets a `localStorage` flag
  (`as-desktop-preview`) that suppresses the notice at ≥1024px so desktop-redesign work can still be
  viewed locally above the cutoff without editing code. Persists across reloads once set; no UI for
  real users to discover or toggle it.

## Wiring

`app.ts`/`app.html`: swap `<router-outlet />` for `<app-desktop-notice />` when
`breakpoint.isDesktopNotice()` is true. Full replacement, not layered — no `MainLayout`,
`HeaderNav`, `DrawerHost`, or route content mounts underneath.

## Component

New `shell/desktop-notice/` component. Static content, no route of its own, no relation to
`MainLayout`. Content scope is deliberately narrow — the shared design reference
(`context/screenshots/Desktop.png`) is a *journey* reference, not a literal spec; only these elements
are kept, styled with existing design tokens (`--navy-800`, `--amber-600`, `--gray-*`, Strichpunkt
Sans) rather than reference colors:

1. **Header bar** — white background, thin `--gray-200` bottom border, `as_logo.png` + "ActivSwitzerland"
   in `--navy-800`. No nav links, no hamburger (unlike `HeaderNav`).
2. **Hero text** — eyebrow "A better way to explore", heading "The best of **Switzerland** is on its
   way." ("Switzerland" in `--amber-600`), paragraph "We're crafting a desktop experience worthy of
   the places you'll discover. Until then, take the scenic route on mobile."
3. **Screenshot carousel** — one slide visible at a time, tilted (`rotate(-4deg)`) with a drop shadow,
   caption next to it. Prev/next controls + dot indicators. Six slides, fixed mapping:

   | Asset | Caption |
   |---|---|
   | `mobile1.png` | Explore Switzerland |
   | `mobile2.png` | Take a city break |
   | `mobile3.png` | Look-up attractions in the area |
   | `mobile4.png` | Search for places & things to do |
   | `mobile5.png` | Plan your own trip by rail or car |
   | `mobile6.png` | See trips shared by others |

Everything else on the reference (top banner strip, "Visit mobile site" link, CTA button, stat
badges, "01/03" counter styling) is intentionally not built.
