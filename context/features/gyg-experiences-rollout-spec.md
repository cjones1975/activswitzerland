# GetYourGuide Experiences — Rollout to All Mapped Destinations

## Overview

Follow-up to `gyg-experiences-poc-spec.md`. The POC (Lauterbrunnen only, location ID hardcoded in
`GYG_LOCATIONS` in `frontend/src/app/shared/services/gyg.ts`) was approved. This spec rolls the
Experiences / Day trips section out to every destination in the `hotelDestinations` table that has a
GYG location ID, by storing that ID in the table. **No location ID stays hardcoded in the frontend.**

UI and behaviour are unchanged from the POC: the panel below the attractions with 3 items, the
Experiences drawer with 30 items, lazy loading, and clearing map pins on "See more".

## Current state (verified in code)

- `backend/src/models/HotelDestination.js`: fields `identifier`, `name`, `category`, `destId`,
  `destType`. No GYG field.
- `backend/src/controllers/hotels.js` `getHotelDestinations`: `HotelDestination.find()` returns every
  document whole, so a new field reaches the client with no controller change.
- `frontend/src/app/models/hotel-destination.ts`: `HotelDestinationMapping` interface.
- `frontend/src/app/shared/services/hotels.ts`: loads the table once into a signal. `mappingFor()`
  reads that signal, so `computed()`s built on it react once the load resolves.
- `frontend/src/app/shared/services/gyg.ts`: `GYG_LOCATIONS` constant (Lauterbrunnen → 2863) and
  `locationIdFor()`. Used by `destination-detail.ts` (`gygLocationId`) and `drawer-host.ts`
  (`experiencesLocationId`).
- `backend/src/data/hotelDestinations.json`: 48 rows (28 cities + 20 villages). There's no seeder
  script. The data is imported manually.

## Location IDs (provided by the user)

46 of 48 rows have an ID. **Delémont and Frauenfeld have none** and won't show the section.
Lauterbrunnen and Mürren share `2863`, which is intentional.

| Name | ID | Name | ID | Name | ID |
|---|---|---|---|---|---|
| Geneva | 54 | Chur | 2042 | Gstaad | 178336 |
| Bern | 52 | Lausanne | 463 | Lauterbrunnen | 2863 |
| Delémont | — | Brig | 100779 | Grindelwald | 1613 |
| Solothurn | 193865 | Neuchâtel | 199979 | Wengen | 119160 |
| Biel | 250 | Basel | 51 | Mürren | 2863 |
| Baden | 2632 | Bellinzona | 99510 | Engelberg | 53 |
| La Chaux-de-Fonds | 101169 | Schaffhausen | 2822 | Saas-Fee | 95804 |
| Aarau | 101112 | Sion / Sitten | 156369 | Pontresina | 137218 |
| Zug | 95858 | Lugano | 2524 | Davos | 883 |
| Locarno | 4610 | Montreux | 32355 | Klosters | 157259 |
| Olten | 103701 | Frauenfeld | — | Andermatt | 140986 |
| Winterthur | 102177 | Thun | 103011 | Interlaken | 793 |
| St. Gallen | 101973 | Zermatt | 1514 | Gruyères | 135077 |
| Zurich | 55 | St. Moritz | 1551 | Appenzell | 1580 |
| Fribourg | 135082 | | | Ascona | 98910 |
| Rapperswil-Jona | 1324 | | | Stein am Rhein | 2825 |
| | | | | Brienz | 1533 |
| | | | | Murten | 101187 |

The user's list was in exactly the same order as the seed JSON's rows, so every row was matched
unambiguously despite spelling differences ("Schaffausen", "Neuchatel", "Délémont").

## Requirements

### 1. Backend schema

`HotelDestination.js`: add an optional field:

```js
gygLocationId: {
    type: Number,
    required: false
}
```

It's optional (no default) so rows without an ID simply lack the field. It's independent of the
Booking.com fields: a row can have hotels, experiences, or both.

### 2. Seed data

`backend/src/data/hotelDestinations.json`: add `"gygLocationId": <n>` to the 46 rows that have an
ID. Delémont and Frauenfeld get no field (not `null`).

### 3. Databases

- **Local dev** (`activswitzerland_mongodb` Docker container): Claude applies targeted updates
  with `mongosh`, `updateOne({ identifier }, { $set: { gygLocationId } })` per row. There's no
  drop and re-import, so other fields (such as the manual Klosters `destType` fix) are untouched and
  running it twice is harmless.
- **Production (NAS):** the user updates it manually through MongoDB Compass. No script is needed.

### 4. Frontend

- `hotel-destination.ts`: `gygLocationId?: number` on `HotelDestinationMapping`.
- `gyg.ts`: **remove `GYG_LOCATIONS`**. `locationIdFor(identifier)` becomes
  `this.hotels.mappingFor(identifier)?.gygLocationId`, injecting `HotelsService`. Because
  `mappingFor` reads a signal, the existing `computed()`s in `destination-detail` and `drawer-host`
  stay reactive with no changes there.

### 5. Deploy order

1. The user updates the production database via Compass.
2. Deploy the backend (schema field).
3. Deploy the frontend.

Deploying in any other order just means the section stays hidden until all three are live. Nothing
breaks.

## Out of scope

- **Cookie consent.** The user plans a consent banner shown on first visit (see
  `cookie-consent-matomo-spec.md`) as a separate feature. Once it exists, `GygService.ensureScript()`
  must only inject GYG's script after the user has consented. Until then, the widget loads without
  asking for consent.
- Privacy policy changes (user decision: no GYG mention).
- Renaming `HotelDestination` / `hotelDestinations`, even though the table now serves more than hotels.
  It's not worth a collection migration for now.

## Verification

- Backend/frontend build passes (Claude).
- Local database: count of documents with `gygLocationId` = 46; Delémont and Frauenfeld lack it
  (Claude).
- In the browser (user): the section shows on a few destinations (a city, a village, Mürren sharing
  Lauterbrunnen's ID) and is absent on Delémont and Frauenfeld.
