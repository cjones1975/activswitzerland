# Home Page — Destination Category Sections

## Overview

Add two new destination sections below the existing City Breaks section on the home page: **Mountains, Lakes & Glaciers** and **Nature Parks**. All three sections use the same `DestinationHorizontalList` component but with different API facets. The sections use a banded layout with alternating background colors to visually separate them. The destinations page (`DestinationVerticalList`) must be made dynamic so it displays the correct data and map icon depending on which section the user navigated from.

## Requirements

### Category config model

- Create a `destination-category.ts` model at `@frontend/src/app/models/`
- Define a `CategoryKey` type: `'cities' | 'mountains-lakes' | 'nature-parks'`
- Define a `CategoryConfig` interface with fields: `facets`, `title`, `subtitle`, `pageSubtitle`, `cardTitle`, `mapIcon`
- Export a `DESTINATION_CATEGORIES` record keyed by `CategoryKey` with the following entries:

**cities**
- facets: `placetypes:cities`
- title: `destinations.cityBreaks.title`
- subtitle: `destinations.cityBreaks.subtitle`
- pageSubtitle: `destinations.allCities.subtitle`
- cardTitle: `City`
- mapIcon: `fa-sharp fa-house-turret`

**mountains-lakes**
- facets: `[placetypes:mountains,placetypes:mountainpasses,placetypes:glaciers,placetypes:mountainlakes,placetypes:smalllakes,placetypes:biglakes,placetypes:lakes]`
- title: `destinations.mountains.title`
- subtitle: `destinations.mountains.subtitle`
- pageSubtitle: `destinations.mountains.count`
- cardTitle: `Mountain`
- mapIcon: `fa-sharp fa-solid fa-mountain`

**nature-parks**
- facets: `[placetypes:natureparks,placetypes:wildlifeparks]`
- title: `destinations.natureParks.title`
- subtitle: `destinations.natureParks.subtitle`
- pageSubtitle: `destinations.natureParks.count`
- cardTitle: `Nature Park`
- mapIcon: `fa-sharp fa-solid fa-deer`

### Home page — banded sections

- Replace the current `.destinations-section` wrapper in `home.html` and `home.css` with a `.home-section` pattern
- Each section has a `.section-inner` div that centers content (max-width: 2000px, same padding as before)
- Section backgrounds:
  - City Breaks: `#ffffff` (white)
  - Mountains, Lakes & Glaciers: `#f5f6f7` (very light gray) — add modifier class `.home-section--gray`
  - Nature Parks: `#ffffff` (white)
- Render three `DestinationHorizontalList` components, one per section, with these inputs:

**City Breaks**
- cardTitle: `City`
- title: `destinations.cityBreaks.title`
- subTitle: `destinations.cityBreaks.subtitle`
- facet: `placetypes:cities`
- viewAllRoute: `/destinations`
- viewAllQueryParams: `{ category: 'cities' }`

**Mountains, Lakes & Glaciers**
- cardTitle: `Mountain`
- title: `destinations.mountains.title`
- subTitle: `destinations.mountains.subtitle`
- facet: `[placetypes:mountains,placetypes:mountainpasses,placetypes:glaciers,placetypes:mountainlakes,placetypes:smalllakes,placetypes:biglakes,placetypes:lakes]`
- viewAllRoute: `/destinations`
- viewAllQueryParams: `{ category: 'mountains-lakes' }`

**Nature Parks**
- cardTitle: `Nature Park`
- title: `destinations.natureParks.title`
- subTitle: `destinations.natureParks.subtitle`
- facet: `[placetypes:natureparks,placetypes:wildlifeparks]`
- viewAllRoute: `/destinations`
- viewAllQueryParams: `{ category: 'nature-parks' }`

### DestinationHorizontalList — query param support for "View all"

- Add a `viewAllQueryParams` input (`Record<string, string>`, default `{}`)
- Update the "View all" anchor in the template to bind `[queryParams]="viewAllQueryParams"` alongside the existing `[routerLink]="viewAllRoute"`

### DestinationVerticalList — dynamic category

- Inject `ActivatedRoute` and read the `?category=` query param on init
- Look up the matching `CategoryConfig` from `DESTINATION_CATEGORIES`; default to `cities` if the param is absent or unrecognised
- Hold the resolved config in a `signal<CategoryConfig>` so the template can reference it reactively
- Use `combineLatest` of `queryParamMap` and `onLangChange` to re-fetch whenever the category or language changes
- Pass `config().facets` to `getDestinations` (hitsPerPage: 50)
- Drive the page title and subtitle from `config().title` and `config().pageSubtitle` (with `{ count: destinations.length }` interpolation)
- Drive the card type badge from `config().cardTitle`
- Pass `config().mapIcon` as the `icon` field on each `MapMarker` so the map displays the correct Font Awesome icon per category
- Remove the now-unused static `@Input()` properties (`cardTitle`, `title`, `subTitle`, `facet`)

### Translations

Add the following keys to all four language files (`en`, `de`, `fr`, `it`) under `destinations`:

**English**
```json
"mountains": {
  "title": "Mountains, Lakes & Glaciers",
  "subtitle": "Discover Switzerland's alpine landscapes",
  "count": "{{count}} destinations"
},
"natureParks": {
  "title": "Nature Parks",
  "subtitle": "Explore Switzerland's protected natural habitats",
  "count": "{{count}} destinations"
}
```

**German**
```json
"mountains": {
  "title": "Berge, Seen & Gletscher",
  "subtitle": "Entdecken Sie die alpinen Landschaften der Schweiz",
  "count": "{{count}} Reiseziele"
},
"natureParks": {
  "title": "Naturparks",
  "subtitle": "Erkunden Sie die geschützten Naturgebiete der Schweiz",
  "count": "{{count}} Reiseziele"
}
```

**French**
```json
"mountains": {
  "title": "Montagnes, Lacs & Glaciers",
  "subtitle": "Découvrez les paysages alpins de la Suisse",
  "count": "{{count}} destinations"
},
"natureParks": {
  "title": "Parcs naturels",
  "subtitle": "Explorez les habitats naturels protégés de la Suisse",
  "count": "{{count}} destinations"
}
```

**Italian**
```json
"mountains": {
  "title": "Montagne, Laghi & Ghiacciai",
  "subtitle": "Scopri i paesaggi alpini della Svizzera",
  "count": "{{count}} destinazioni"
},
"natureParks": {
  "title": "Parchi naturali",
  "subtitle": "Esplora gli habitat naturali protetti della Svizzera",
  "count": "{{count}} destinazioni"
}
```

## Notes

- The `DestinationVerticalList` is only used as a routed component (`/destinations`) so removing the static `@Input()` properties is safe
- The `mapIcon` value is an FA class string (`fa-sharp fa-solid fa-mountain`) — the existing `MapMarker.icon` field and `buildMarkerEl` in `map.ts` already support this; no changes needed to the map component
- The facet string format uses square brackets for multi-value filters (e.g. `[placetypes:mountains,placetypes:glaciers]`); the backend passes the string through `encodeURIComponent` directly to the MySwitzerland API

## References

- @context/features/dest-horizontal-list-spec.md
- @context/features/dest-vertical-list-spec.md
- @context/project-overview.md
