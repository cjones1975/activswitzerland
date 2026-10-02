# SEO: Keyword-Targeted Destination Titles & Descriptions

## Why

Destination pages (~280 × 5 locales, the bulk of the sitemap) currently send
`<title>Lake Staz | ActivSwitzerland</title>` and a meta description copied verbatim from the
MySwitzerland API. The title carries only the place name — none of the intent words people
actually search ("things to do", "hikes", "bike routes") — and the description duplicates text
Google already indexes on MySwitzerland.com.

## Decisions (agreed with user, 2026-10-02)

- Change only `<title>` (plus `og:title`/`twitter:title`, which share it) and the meta
  description. The visible `<h1>` stays the plain place name.
- Place name once, first, followed by a colon — avoids keyword-stuffing (Google rewrites stuffed
  titles) and avoids "in Lake Staz"-style grammar across cities/mountains/lakes.
- Keep within ~60 visible characters for typical names; most-searched terms first.
- "Bike Routes" is safe to promise — user confirmed ~99% of destinations have bike routes.
- Weather / walking / getting-there go in the description (~155 chars), not the title.
- Description is our own template wording, no longer the MySwitzerland text.
- JSON-LD `Place.description` keeps the MySwitzerland text — it describes the place itself, not
  the page.

## Templates

| Key | en |
|---|---|
| `seo.destinationDetail.title` | `{{name}}: Things to Do, Hikes & Bike Routes` |
| `seo.destinationDetail.description` | `Plan your visit to {{name}}: hiking and walking trails, bike routes, local weather, top attractions and how to get there by public transport.` |

`SeoService.set()` appends ` | ActivSwitzerland`. de/fr/it/es written for how people search in
each language (not literal translation), matching each file's existing tone (de: du-form, "Velo").
Phrasing avoids prepositions before `{{name}}` so it reads correctly for any destination type.

## Changes

- `public/i18n/{en,de,fr,it,es}.json`: add `seo.destinationDetail.{title,description}`.
- `shell/destinations-layout/destinations-layout.ts`: `seo.set()` uses the two keys via
  `translate.instant(key, { name: dest.name })`.

## Follow-ups (not in this change)

- Practical-info pages use only the category label as description.
- Keyword research from Search Console Performance data once SSR-fixed pages accumulate
  impressions (~3–4 weeks).
