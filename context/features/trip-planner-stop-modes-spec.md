# Trip Planner Stop Search — Language, TopographicPlace, Mode Icons

**Status: implemented** (`feature/trip-planner-stop-modes`, not yet merged).

## Overview

Three follow-on changes to the OJP location search built in `ojp-location-search-spec.md`,
all touching `backend/src/utils/ojp.js` (request builder + response mapper),
`backend/src/controllers/transport.js` (passes the new param through), and
`frontend/src/app/shared/services/transport.ts` (`searchLocations()`):

1. **Pass the app's selected UI language** to OJP's `Restrictions/Language`.
2. **Road trips restrict on `topographicPlace` instead of `address`.** Display name switches from
   the generic `Place/Name` to the type-specific `TopographicPlaceName`.
3. **Rail results show mode icons** (bus/rail/tram/metro/water/telecabin/…) on the right of the
   stop name, read from `Place/Mode[]/PtMode`. Road results get a single static location-pin icon
   instead (OJP's `Mode` block doesn't apply to `TopographicPlace`/`Address` results).

## Confirmed decisions (updated post-live-verification)

- **Language param**: `Restrictions/Language` (`xs:language`) exists per the OJP 2.0 schema,
  ordered `Type` → `Language` → `NumberOfResults`. Sent on every request regardless.
  **Verified live — does not appear to be honored**: queried `Zurich`/`Geneve` with `lang` cycled
  through `en`/`de`/`fr`/`it` and always got the same spelling back; searching the German exonym
  `Genf` while requesting `lang=fr` still returned `"Genf"`, not `"Genève"`. So `TopographicPlaceName`
  reflects whatever alias the *query text* matched, not the requested `Language` — same class of
  "soft hint, not a hard rule" behavior the original OJP feature found with `NumberOfResults`. Kept
  in the request anyway (harmless, schema-legal, and may affect fields not tested here), but don't
  expect it to translate result names.
- **`address` → `topographicPlace`**: `OJP_PLACE_TYPE` in `ojp.js` is
  `{ station: 'stop', address: 'topographicPlace' }`. **Verified live**: a plain town-name query
  (e.g. "Geneve") returns exactly one clean `TopographicPlace` result, not a flood of nested
  regions/cantons — behaves as cleanly as `address` did in the original feature. Frontend's own
  `type=station|address` query param and internal `type: 'station'|'address'` vocabulary are
  unchanged; only the OJP wire value road trips restrict on changed.
- **Display name field**: `StopPlaceName`/`TopographicPlaceName` (type-specific), falling back to
  the generic `Place/Name` if absent.
- **Mode icons**: `Place/Mode[]/PtMode`, confirmed live via Geneva (bus + 4 rail submodes → deduped
  to `["bus","rail"]`) and Zermatt (`Zermatt GGB`/`Zermatt Schwarzsee` → `["telecabin"]`). Distinct
  `PtMode` values map to an icon via:

  | `PtMode` | icon |
  |---|---|
  | `bus` | `fa-solid fa-bus` |
  | `trollybus` | `fa-solid fa-bus` |
  | `rail` | `fa-solid fa-train` |
  | `tram` | `fa-solid fa-train-tram` |
  | `metro` | `fa-solid fa-train-subway` |
  | `water` | `fa-solid fa-ship` |
  | `telecabin` | `fa-solid fa-train-subway` |
  | `cableway` | `fa-solid fa-cable-car` |
  | `air` | `fa-solid fa-plane` |
  | anything else | (no icon — silently dropped) |

  Icons render in the fixed table order above (not API response order), one per distinct `PtMode`
  regardless of how many `Mode` entries share it.
  **Corrected during live verification**: the wire value is `telecabin`, not `telecabine` as
  originally guessed — confirmed via Zermatt's GGB (rack railway) and Schwarzsee cable-car stops,
  both of which come back as `PtMode: telecabin` (there is no separate `funicular` PtMode value;
  rack/cog railways and aerial cabins both use `telecabin` in this dataset). FontAwesome has no
  dedicated telecabin/funicular icon, so `telecabin` reuses `fa-train-subway` per explicit user
  choice (not `fa-cable-car`, which stays reserved for the separate `cableway` PtMode value).
- **Road results**: no `Mode` block on `TopographicPlace`/`Address` results. Frontend renders a
  single static `<i class="fa-solid fa-location-dot"></i>` for every `type: 'address'` result,
  not driven by API data.

## Backend

### `backend/src/utils/ojp.js`

- `OJP_PLACE_TYPE`: `{ station: 'stop', address: 'topographicPlace' }`.
- `VALID_LANGS = ['en','de','fr','it']`; `PT_MODE_ORDER` (the recognized-`PtMode` allowlist, in
  render-priority order): `['bus','trollybus','rail','tram','metro','water','telecabin','cableway','air']`.
- `buildLocationInformationRequest(query, type, lang)`: new third param, whitelisted against
  `VALID_LANGS` (falls back to `'en'`), inserted as `<Language>` between `<Type>` and
  `<NumberOfResults>`.
- `xmlParser`'s `isArray`: `name === 'PlaceResult' || name === 'Mode'` — a `StopPlace` with only
  one `Mode` would otherwise parse as a bare object instead of a one-element array.
- `mapPlace(place)`: reworked around a shared `textOf()` helper (reads `Text['#text'] ?? Text ?? ''`
  off any `InternationalTextStructure`) and `extractModes(place.Mode)` (dedupes `PtMode` values into
  a `Set`, then filters `PT_MODE_ORDER` by membership — this both dedupes and fixes the render
  order in one pass). Three branches, all returning `{ id, name, type, coordinate, modes }`:
  - `StopPlace` → `type: 'station'`, name from `StopPlaceName` (falls back to generic `Name`),
    `modes` from `extractModes`.
  - `TopographicPlace` (new) → `type: 'address'`, name from `TopographicPlaceName` (falls back to
    generic `Name`), `id` from `TopographicPlaceCode` (falls back to `` `topo:${lat},${lon}` ``),
    `modes: []`.
  - `Address` (kept, not removed — belt-and-suspenders in case OJP ever mixes `Address` results
    into a `topographicPlace`-restricted response) → `type: 'address'`, `id` from `PublicCode`
    (falls back to `` `addr:${lat},${lon}` ``), `modes: []`.
  - Note: `parseLocationInformationResponse`'s existing keep-if-type-matches re-check
    (`place.type !== 'address'`/`'station'`) needed **no code change** — since both `TopographicPlace`
    and `Address` branches already tag their result `type: 'address'`, the existing check covers
    both transparently.

### `backend/src/controllers/transport.js`

- `getLocations`: `buildLocationInformationRequest(req.query.location, req.query.type, req.query.lang)`.

## Frontend

### `frontend/src/app/shared/services/transport.ts`

- `LocationResult` (raw backend shape) and `LocationSearchResult` (what callers consume) both gain
  `type: 'station' | 'address'` and `modes: string[]`. `LocationSearchResult` didn't carry `type`
  at all before this feature (callers never needed to render per-result differences).
- `searchLocations()`: injects `LangService`, sends `lang: this.langSvc.current` as a query param.

### `frontend/src/app/shared/utils/transport-mode-icons.ts` (new)

- `MODE_ICON: Record<string,string>` (the icon table above) + `resultIcons(result): string[]` —
  `['fa-solid fa-location-dot']` for `type === 'address'`, else `result.modes` mapped through
  `MODE_ICON` (unrecognized/missing entries filtered out). Single source of truth shared by both
  places results render, instead of duplicating the icon-class table.

### `location-search-sheet.html`/`.css`

- `.lss-result` button: `display:flex; justify-content:space-between`, name in a plain `<span>`,
  icons in a new right-aligned `.lss-result-icons` span, rendered via `resultIcons(r)`.

### `step2-itinerary.html`/`.ts`/`.css`

- All four `p-autoComplete`s (`depAuto`/`viaAuto`/`destAuto`/`addAuto`, none of which had a custom
  item template before) gained `<ng-template let-item pTemplate="item">` rendering `item.name` +
  the same right-aligned icon group (`.s2-ac-item`/`.s2-ac-icons`, `::ng-deep`-scoped since
  PrimeNG's autocomplete panel renders inside the component's own view here — this app deliberately
  doesn't use `appendTo="body"` on these fields, per the focus-steal bug found and reverted during
  the Trip Planner Page Redesign feature).
- `resultIcons` exposed as a plain class property (`readonly resultIcons = resultIcons;`) on both
  `Step2Itinerary` and `LocationSearchSheet` so the template can call it directly.

## Verification

- `node --check` on both modified backend files.
- `tsc --noEmit` and `ng build --configuration production` — both clean (only the pre-existing
  bundle-size/CommonJS warnings this app already ships with).
- Live end-to-end: isolated local backend (`NODE_ENV=test`, port 3099, separate from the user's
  running Docker dev stack) queried directly against the real
  `https://api.opentransportdata.swiss/ojp20`:
  - `type=station` (Geneve, Zermatt, Verbier, Engelberg, Interlaken Ost) — clean per-stop mode
    dedup/ordering (`bus`+`rail`, `water`-only for a ferry terminal, `telecabin`-only for
    GGB/Schwarzsee, etc.)
  - `type=address` (Geneve) — one clean `TopographicPlace` result, `id` populated from
    `TopographicPlaceCode`
  - `lang` cycled through all four values on the same query — confirmed no effect on returned name
    text (see "Language param" above)
  - Found and fixed the `telecabine`→`telecabin` spelling live via the Zermatt case, which
    originally came back with `modes: []` under the wrong spelling
- Not yet exercised in a real browser session (no browser-automation tool in this environment) —
  flagged same as prior features in this area.

## References

- @backend/src/utils/ojp.js
- @backend/src/controllers/transport.js
- @frontend/src/app/shared/services/transport.ts
- @frontend/src/app/shared/services/lang.ts
- @frontend/src/app/shared/utils/transport-mode-icons.ts
- @frontend/src/app/features/trip-planner/step2-itinerary/location-search-sheet/location-search-sheet.html
- @frontend/src/app/features/trip-planner/step2-itinerary/step2-itinerary.html
- @context/features/ojp-location-search-spec.md (the feature this one iterates on)
- https://github.com/VDVde/OJP (OJP 2.0 XSD — `OJP_Locations.xsd`'s `PlacePolicyGroup`/
  `PlaceTypeEnumeration`, `OJP_PlaceSupport.xsd`'s `TopographicPlaceStructure`/`PlaceStructure`)
