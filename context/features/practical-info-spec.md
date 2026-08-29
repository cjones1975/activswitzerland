# Practical Info Section (Homepage) + Content Pages

## Overview

Add a new "New to Switzerland?" section to the homepage, below Nature Parks: a 2x2 grid of
4 amber boxes, each with 3 icons and a label, linking to a new full-page content article under
`frontend/src/app/features/practical-info/`. The 4 topics are Getting around, The great outdoors,
Cost of living, and Culture & history. Content is long-form and will be translated into all 5
supported locales (en/de/fr/it/es) from day 1, but is kept out of the `i18n/*.json` translation
files — those stay reserved for short UI strings.

Homepage mockup (approved direction, colors/spacing to match):
https://claude.ai/code/artifact/03b44ab9-af07-45e2-8591-0a74f2e376a8

## Content model & translation strategy

- English source drafts already exist at `context/content/*.md`:
  `getting-around.md`, `great-outdoors.md`, `cost-of-living.md`, `culture-swiss-history.md`.
- Final content is served as markdown, one file per locale per topic, at
  `public/content/practical-info/<slug>/<lang>.md` — following the same "served from `public/`,
  fetched at runtime" pattern the app already uses for `public/i18n/*.json`.
- Slugs: `getting-around`, `great-outdoors`, `cost-of-living`, `culture-history` (shortened from
  the source file's `culture-swiss-history.md` for a cleaner URL segment — confirm before
  implementation).
- User will supply de/fr/it/es translations of each file before/at implementation; the frontend
  should still defensively fall back to `en.md` if a given locale's file 404s, so a page never
  renders blank if a translation is delayed.
- **Not added to `i18n/*.json`.** Rationale: these are long-form prose documents (~70-80 lines of
  markdown each), not short key/value UI strings — mixing them into `en.json` etc. would bloat
  those files, produce unreviewable diffs, and break the existing "edit `en.json`, mirror to
  de/fr/it/es in the same pass" workflow, since this content won't be edited on the same cadence.
  This mirrors the precedent already set for the Terms & Privacy pages, which are long-form
  content kept out of the i18n system (there, English-only with a disclaimer, since no legal
  review of translations existed — here, real translations are being provided instead, so no
  disclaimer is needed, but the content still lives outside `i18n/*.json`).
- Only short surrounding UI strings — the homepage section title/subtitle, the 4 box labels, and
  any page-level chrome (e.g. a back-nav label) — go into `i18n/*.json`, mirrored across all 5
  locales as usual.

## New dependency: markdown renderer

- Nothing in the frontend currently parses full markdown. The closest existing thing,
  `shared/utils/chat-markdown.ts`, only hand-rolls `**bold**` and `- bullets` for AI chat replies —
  not enough for the headers, links, horizontal rules, and lists these content files use.
- Add a small markdown-parsing library (e.g. `marked`) as a new frontend dependency.
- New shared component, e.g. `shared/markdown/markdown.ts` (+ `.html`/`.css`), taking a raw
  markdown string `@Input()`, parsing it with the library, and rendering the result via Angular's
  `DomSanitizer.bypassSecurityTrustHtml`. Unlike `chat-markdown.ts` (which escapes untrusted model
  output before allowing a narrow set of tags back in), this content is site-authored and fully
  trusted, so full HTML output from the parser is fine to trust directly.

## Category config model

New model, same shape as the existing `destination-category.ts` precedent
(`frontend/src/app/models/destination-category.ts`):

- `frontend/src/app/models/practical-info-category.ts`
- `PracticalInfoKey` type: `'getting-around' | 'great-outdoors' | 'cost-of-living' | 'culture-history'`
- `PracticalInfoConfig` interface: `{ icons: [string, string, string]; label: string /* i18n key */ }`
- `PRACTICAL_INFO_CATEGORIES: Record<PracticalInfoKey, PracticalInfoConfig>`, one entry per topic,
  icons taken from the approved mockup:
  - `getting-around`: `fa-solid fa-plane-arrival`, `fa-sharp fa-solid fa-ticket`, `fa-solid fa-train`
  - `great-outdoors`: `fa-solid fa-compass`, `fa-solid fa-route`, `fa-solid fa-cabin`
  - `cost-of-living`: `fa-regular fa-money-bill-1-wave`, `fa-solid fa-plate-utensils`, `fa-solid fa-bed`
  - `culture-history`: `fa-solid fa-globe`, `fa-solid fa-box-ballot`, `fa-solid fa-comments`

## Homepage section

- Add to `home.html`, below the Nature Parks section, matching the approved mockup: a
  `.home-section--gray` band containing a section title + subtitle and a 2x2 grid of 4 boxes.
- Section title: `practicalInfo.title` → "New to Switzerland?"; subtitle:
  `practicalInfo.subtitle` → "Practical guides for your first weeks here" — new i18n keys,
  mirrored across en/de/fr/it/es.
- Render the 4 boxes from `PRACTICAL_INFO_CATEGORIES` (loop, not 4 hand-copies) — each a
  `routerLink` via `langSvc.localize(['practical-info', key])`, box background `var(--amber-600)`,
  icon/label color `var(--navy-900)`, 12px radius (matching the existing destination-card radius),
  per the mockup.
- Box labels as i18n keys, e.g. `practicalInfo.gettingAround`, `.greatOutdoors`, `.costOfLiving`,
  `.cultureHistory` — mirrored across all 5 locales.

## Practical info pages

- New feature folder `frontend/src/app/features/practical-info/`.
- Recommend **one parametrized component** (e.g. `practical-info-detail/`) reading a `:slug` route
  param and looking it up in `PRACTICAL_INFO_CATEGORIES`, rather than 4 near-duplicate components —
  mirrors how `destination-vertical-list` already reads a `?category=` query param against
  `DESTINATION_CATEGORIES` instead of having one component per category.
- On init (and on slug/lang change), fetches `/content/practical-info/<slug>/<lang>.md` via
  `HttpClient`, falls back to `/content/practical-info/<slug>/en.md` on 404, renders the result
  through the new shared markdown component.
- Full routed page (not a drawer) — matches the Terms & Privacy pages' pattern, not the
  destination/hike/bike drawer pattern, since these are standalone articles with no map/list
  context to return to.
- Page chrome: title (from the markdown's own `# Heading`, or a matching i18n label) + a back-nav
  affordance, styled consistently with the rest of the app's detail pages.

## Routing

New route in `app.routes.ts`, inside the existing `:lang` → `MainLayout` children array, alongside
`terms-and-conditions`/`privacy-policy`:

```ts
{
  path: 'practical-info/:slug',
  loadComponent: () => import('./features/practical-info/practical-info-detail/practical-info-detail')
    .then(m => m.PracticalInfoDetail),
},
```

## Sitemap

`frontend/scripts/generate-sitemap.mjs` (postbuild step) currently hardcodes a `pages` array with
just the static routes (`''`, `/destinations`) plus the fetched destination/trip ids — note that
`terms-and-conditions`/`privacy-policy` were deliberately left out of it (low SEO value), but these
4 practical-info pages are genuine content pages and should be included, unlike the legal pages.

- Add the 4 slugs as static entries in `buildSitemap`'s `pages` array, one per
  `PracticalInfoKey` (`getting-around`, `great-outdoors`, `cost-of-living`, `culture-history`),
  each with `lastmod: buildDate` (same as the other two static entries — these are static local
  content, not fetched from an external API with no per-item modified date, so a real build-date
  `lastmod` is honest here) and a priority in the `/destinations`-detail tier (`0.6`–`0.7`).
- No other change needed — `SUPPORTED_LANGS.flatMap` already expands every static `pages` entry
  across all 5 locale prefixes, so adding the 4 slugs once covers `/en|de|fr|it|es/practical-info/<slug>`
  automatically.
- This also feeds directly into the still-open "content-depth" item from the SEO Phase 4 work
  (Bing verification/IndexNow aside) — these are exactly the kind of indexable content pages that
  work was waiting on.

## Open questions / to confirm before implementation

- Final URL slugs, especially `culture-history` vs. keeping the source filename's
  `culture-swiss-history`.
- The great-outdoors content references trail-sign colors and already has 3 unused image assets
  sitting in `frontend/src/assets/` (`sign_alpine.png`, `sign_mountain.png`, `sign_route.png`,
  currently untracked, not yet referenced anywhere) that look intended for this page — confirm
  whether these should be wired in as inline markdown images (`![...](/assets/sign_alpine.png)`)
  and whether they should move to `public/` alongside the content for consistency.
- Confirm `marked` as the parser (small, no runtime dependencies of its own) vs. another option.
- The English drafts contain placeholder markers like `*(Insert link: ...)*` and bare URLs on
  their own line — these should be cleaned into real markdown links before/during translation;
  the renderer won't special-case them.

## Notes

- Translation cadence for this content is manual, not automatic: an edit to an English `.md` file
  needs a follow-up translation pass on the other 4 locale files — unlike `i18n/*.json`, there's no
  single-PR key-parity check for this content.

## References

- @context/features/home-categories-spec.md — category-config-record precedent
  (`DESTINATION_CATEGORIES`/`destination-vertical-list`'s `?category=` pattern)
- @context/features/terms-consent-legal-pages-spec.md — precedent for long-form page content kept
  out of the i18n system
- @context/content/getting-around.md, great-outdoors.md, cost-of-living.md,
  culture-swiss-history.md — English source content
