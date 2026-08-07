# Desktop Redesign Phase 3 (partial): Homepage Destination Card Rails, Search, Explore Trips

Part of the master plan's Phase 3 (`context/features/desktop-responsive-redesign-spec.md`) — pulled
forward as a self-contained slice, same branch (`feature/desktop-split-view-foundations`). Scope:
`destination-horizontal-list` (used for all three homepage rails — City Breaks, Mountains, Nature
Parks — `home.html:37-75`), the component this repo's earlier audit flagged as capped at a 200px card
from 768px all the way to 1920px+.

## Confirmed decision

User: cards should sit in a **grid inside a max-width container** (not a wider horizontal-scroll
strip) at desktop, sized to **~4x the mobile card's 160px width**.

## Implementation

`destination-horizontal-list.css`, two new breakpoint tiers on top of the existing 768px one
(unchanged: <768px stays a 160px-card scroll strip, 768-1023px stays 200px):

- **≥1024px**: `.scroll-strip` switches from `display: flex` (horizontal scroll) to `display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr))`, capped at `max-width: 900px; margin:
  0 auto`. `auto-fit`/`minmax` rather than a hand-picked column count per breakpoint — the *max-width
  cap* is what actually determines how many columns settle out (at 900px this lands on 2 columns of
  ~420px, ~2.6x mobile — a deliberate transitional step, not yet the target size). Card height 360px
  (up from 240px). `.list-header` (title/"View all") gets the same `max-width: 900px` + centering so
  it stays visually aligned with the grid below it, rather than spanning the page's full width while
  the grid sits narrower.
- **≥1536px**: `max-width` grows to 1300px, `minmax` floor to 560px — settles on 2 columns of ~640px
  (**4x the 160px mobile card, on the nose** — "almost 4x" landed almost exactly at 4x). Card height
  480px, `.card-name`/`.card-type` font-size bumped up proportionally (a 1rem name label looked
  undersized against a 640px-wide photo card). `.list-header` max-width grows to match.

No changes to `destination-horizontal-list.ts`/`.html` — same 10-destination fetch, same skeleton
loading state, same card markup; only the container/grid CSS and card dimensions changed.

## Part 2: `/search`

Confirmed decision: same container tiers as the homepage rails, images/text slightly bigger.

- `search-page.css`: `.search-page` already defaulted to `max-width: 900px` (matching the rails'
  first tier already, no change needed there) — gained a second tier, `max-width: 1300px` at
  `>=1536px`, matching the rails' second tier exactly.
- `destination-search-results.css` and `attraction-search-results.css` (byte-for-byte identical
  files — same fix applied to both): result rows grow `110px -> 140px` at `>=1024px` ->
  `170px` at `>=1536px`. `.card-photo` is a percentage (36%) of the row's own width, so it grows for
  free from both the taller row and the wider container — no separate image-sizing rule needed.
  `.card-name`/`.card-abstract` font sizes bumped slightly at each tier; the abstract's
  `-webkit-line-clamp` opened from 3 to 4 lines at the top tier since there's more vertical room.

## Part 3: Explore Trips

Confirmed decision: add a container, center the page; card sizes are fine as-is; keep 2-per-row
("side by side in pairs") at desktop rather than today's existing jump to 3 columns.

- `explore-trips.css`: `.et-page` (the page's own root wrapper) gained the same two container tiers
  as the homepage rails and `/search` — `max-width: 900px` at `>=1024px`, `1300px` at `>=1536px`.
  The `@media (min-width: 1100px) { .et-grid { grid-template-columns: repeat(3, 1fr) } }` rule was
  removed outright — `.et-grid` now stays at the existing 2-column layout (`>=768px`) all the way up,
  just centered/capped by the page container instead of jumping to 3 columns and spanning the full
  viewport. `trip-card.css` untouched — `.tc-card` has no fixed width (only a fixed `height: 560px`),
  so its width already comes from the grid column and needed no change for this.

## Part 4: Profile page

Confirmed decision: page reads "too stretched out" at desktop — put it in a container.

- `profile.html`: new `.profile-content` wrapper div around everything below the hero banner (stat
  cards, details card, email-verification prompt, saved trips, sign-out) — the only markup change;
  no existing element needed moving, just wrapping.
- `profile.css`: `.profile-content` gets the same two container tiers as the rest of this session's
  Phase 3 work — `max-width: 900px` at `>=1024px`, `1300px` at `>=1536px`, centered. Every element
  inside it already had its own `1rem` side margins (`.stat-row`, `.details-card`, etc.), which now
  read as the gutter inside this container instead of raw viewport-edge margins.
- `.profile-hero` (the navy gradient banner with avatar/name/email) deliberately **left full-bleed,
  unchanged** — not wrapped in the new container. Only asked to fix the stretched-out content below
  it; a full-bleed hero band above a contained content column is a common, intentional pattern rather
  than an oversight.
- `.trips-grid`'s column count (still capped at 2 from 768px onward) was **not** touched — out of
  scope for this specific ask (unlike Explore Trips, where 2-vs-3 columns was explicitly discussed).

**Resolved**: "~4x" was read as **linear** width (160px -> ~640px), landing on a 2-column grid at
typical desktop widths — confirmed by the user ("2 cards is good") as the intended result, and reused
as the standard container/column convention for `/search` and Explore Trips above.

## Verification (user to run live in-browser)

- <768px and 768-1023px: pixel-for-pixel unchanged everywhere (homepage rails, `/search`, Explore
  Trips all still their original mobile/tablet layouts).
- 1024-1535px: homepage rails 2-column grid (~420px cards); `/search` container still 900px (no
  change at this tier, already matched); Explore Trips container now capped/centered at 900px, still
  2 columns.
- >=1536px (1920x1200 especially): homepage rails settle at 2 columns of ~640px cards; `/search`
  container grows to 1300px, result rows 170px tall with legibly bigger text; Explore Trips container
  also grows to 1300px, still 2 columns (no more jump to 3), `trip-card`'s flip cards sized by the
  wider grid column, unchanged internally.
- All three homepage rails, both `/search` tabs (Places/Things), and Explore Trips' infinite-scroll
  grid all behave identically to their respective siblings (no drift between the duplicated
  `destination-search-results.css`/`attraction-search-results.css`).

## References

- @context/features/desktop-responsive-redesign-spec.md (master plan, Phase 3 section)
- @frontend/src/app/features/destinations/destination-horizontal-list/
- @frontend/src/app/features/home/home.html (the three rail usages)
- @frontend/src/app/features/search/search-page/, destination-search-results/, attraction-search-results/
- @frontend/src/app/features/explore-trips/explore-trips.css, explore-trips.html
- @frontend/src/app/features/explore-trips/trip-card/trip-card.css (untouched — width comes from the
  grid column, not a fixed value)
- @frontend/src/app/features/auth/profile/profile.html, profile.css
