# Add Spanish (es) as a Fifth UI Language

## Overview

Spanish joins en/de/fr/it as a fully supported UI locale — its own `/es` route prefix, language-switcher entry, hreflang tag, sitemap entries, and `es.json` translation file, same as the existing four.

Three external data providers are wired to accept a `lang` parameter today, and they don't all treat Spanish the same way:

- **MySwitzerland** (destinations/attractions content) — no allowlist in our code, passes `lang` straight through. Confirmed by the user that their API supports `es`; not independently verified against the live API yet (see Verification).
- **OJP** (`opentransportdata.swiss` — train/transit connections) and **SchweizMobil/geo.admin.ch** (hike & bike route data) — both only publish place/trail names in `en`/`de`/`fr`/`it`. Spanish doesn't exist upstream for either. Both already have a hardcoded language allowlist that silently falls back to `'en'` for anything unrecognized (`ojp.js`'s `VALID_LANGS`, `schweizMobilRoutes.js`'s `SUPPORTED_LANGS`) — this spec deliberately leaves both allowlists unchanged, so Spanish-locale visitors keep seeing English station names and trail names for those two features specifically. That's an accepted, permanent limitation, not a bug to be fixed here.

---

## 1. Core locale registration

`frontend/src/app/shared/services/lang.ts`: add `'es'` to `SUPPORTED_LANGS`. This is the single source of truth most of the app already reads from — `localeMatchGuard`/`bareLangMatcher` (routing), `seo.ts`'s `setHreflang()` (hreflang `<link>` tags), and `profile.ts`'s `localeTabs` (translation-editor tabs) all derive from it directly and need **no separate change**.

`frontend/src/app/shared/services/i18n-loader.ts`: import `es.json` and add `es` to `SERVER_TRANSLATIONS` (SSR/prerendering bundle), alongside `en`/`de`/`fr`/`it`.

---

## 2. New `frontend/public/i18n/es.json`

Full translation of all ~230 keys, mirroring `en.json`'s structure exactly (same nesting, same interpolation placeholders like `{{count}}`/`{{name}}`).

**Open decisions before writing the content pass** (flagging rather than guessing, given the register/consistency issues already found across the existing four files this session):

- **Register**: French uses formal *vous* throughout; German was just normalized to informal *du*; Italian is already consistently informal *tu*. Spanish has no established convention here yet. Recommend informal *tú* — matches 2 of the 3 non-English locales and suits a casual travel-planning app — but this is a real content decision, not a default to assume silently.
- **Dialect**: Castilian vs. Latin American Spanish. Recommend Castilian, as the more likely default for Swiss-tourism-facing content, but flag for confirmation.
- Same caveat raised for the DE/FR/IT review earlier this session applies here too: this agent can produce fluent-reading Spanish but can't self-verify native quality — worth a native-speaker pass before shipping, same as DE/IT.
- Apply the lesson from the `reviewLangOption` bug just fixed in FR/DE/IT: when translating that block, actually translate `"all"`/`"other"` (e.g. `"Todos"`/`"Otro"`) rather than leaving them as literal English — don't repeat that miss on the first pass this time.

---

## 3. Language-switcher UI

Both `menu-nav.ts` and `desktop-notice.ts` hardcode the same 4-entry `languages` array (`{ label, value }` pairs) — add `{ label: 'Español', value: 'es' }` to both. These are the only two places the human-readable language *names* live; everything else works off the `Lang`/`SUPPORTED_LANGS` type.

---

## 4. SEO / sitemap

`frontend/scripts/generate-sitemap.mjs`: its `SUPPORTED_LANGS` constant is a deliberate duplicate of `lang.ts`'s (documented in the file's own header comment — the script runs outside Angular's build pipeline). Add `'es'` here too, or both the sitemap and `robots.txt` disallow-lines will silently omit the new locale.

`seo.ts`'s hreflang generation needs **no code change** — it already imports `SUPPORTED_LANGS` from `lang.ts` and loops over it.

---

## 5. Trip content translation (Claude API)

Curated trips' `name`/`review` get auto-translated via the Claude API (`trip-content-translation-spec.md`). Adding Spanish as an output language:

- `backend/src/utils/translate.js`: add an `es` field to `LOCALE_FIELDS_SCHEMA`'s parent (`TRANSLATION_SCHEMA.properties.es`, added to `required`), update the prompt's language list ("German, French, and Italian" → "German, French, Italian, and Spanish"), and extend the `nameTranslations`/`reviewTranslations` object literals in the return value with `es: parsed.es.name` / `es: parsed.es.review`.
- `backend/src/models/Trip.js`: add `es: String` to `nameTranslations` and `es: { type: String, maxlength: 650 }` to `reviewTranslations`.
- `frontend/src/app/shared/utils/localized-text.ts`: add `es?: string` to both fields of the `LocalizableTrip` interface. `localizedName`/`localizedReview` need no logic change — they already index by the generic `Lang` parameter.

Existing curated trips only regenerate translations on their next English-source edit (existing behavior, no backfill) — so already-published curated trips won't retroactively gain a Spanish variant until edited.

---

## 6. Explore Trips review-language filter + detection

- `backend/src/utils/detect-lang.js`: add `spa: 'es'` to `ISO_639_3_TO_APP_LANG` — franc's ISO 639-3 code for Spanish is `spa`.
- `backend/src/models/Trip.js`: add `'es'` to `reviewLang`'s `enum`.
- `frontend/src/app/models/trip.ts`: add `'es'` to the `reviewLang` union type.
- `frontend/src/app/features/explore-trips/explore-trips-filter/explore-trips-filter.ts`: add `'es'` to `reviewLangOptions`.
- All five `i18n/*.json` files: add `"es": "Es"` to `exploreTrips.filter.reviewLangOption` (matching the existing `en`/`de`/`fr`/`it` abbreviation pattern) — see §2's note on actually translating `all`/`other` in the new `es.json`.

No backfill: any pre-existing Spanish-language reviews written before this feature shipped keep whatever `reviewLang` they were already assigned (most likely `'other'`, since Spanish wasn't detectable before). Only new/re-saved reviews get correctly detected as `'es'` going forward.

---

## 7. Backend external API language passthrough

- **MySwitzerland** (`backend/src/utils/myswitzerland.js`, `backend/src/controllers/myswitzerland.js`): no code change — `lang`/`language` already passes straight through with no allowlist. Confirm against the live API once implemented (see Verification).
- **OJP** (`backend/src/utils/ojp.js`): `VALID_LANGS` stays `['en', 'de', 'fr', 'it']`, deliberately not extended. Update the comment above it to note Spanish is intentionally excluded (not published by the API), so a future reader doesn't "fix" it as an oversight.
- **SchweizMobil** (`backend/src/utils/schweizMobilRoutes.js`): same treatment — `SUPPORTED_LANGS` stays as-is, comment updated for the same reason.
- **`backend/src/utils/aiTools.js`**: update the two `lang` parameter description strings (`search_hikes`/`search_bikes`, currently *"Two-letter UI language code (en/de/fr/it)."*) to mention `es` too, since the model may now see `'es'` as the visitor's app locale. Harmless either way — `searchSchweizMobilRoutes` already falls back to English server-side for any code outside its allowlist, same as it does for any unrecognized value today.

---

## Out of Scope

- No retroactive re-detection/backfill of existing trip reviews' `reviewLang`.
- No Spanish support added to OJP or SchweizMobil/geo.admin.ch — not possible without upstream data that doesn't exist; permanent English fallback for transit connections and hike/bike trail names under the `/es` locale, by design.
- No change to the AI chat agent's conversational language — Claude already replies in whatever language the visitor writes in, independent of the app's UI locale; this feature doesn't touch `aiAgent.js`'s system prompt or add any language threading that doesn't already exist.
- Register (tú/usted) and dialect (Castilian/Latin American) for `es.json`: recommendation given in §2, but treated as an open decision pending confirmation, not assumed.

---

## Verification

- `node --check` on every changed backend file; `tsc --noEmit` / `ng build` clean on the frontend.
- All five `i18n/*.json` files parse as valid JSON after the `es.json` addition.
- `/es` loads the UI in Spanish; language switcher (`menu-nav`, `desktop-notice`) offers and correctly swaps to/from Español.
- **Live call to MySwitzerland with `lang=es`** — confirm real Spanish destination/attraction content comes back, not an English fallback or an error. This is the one assumption in this spec that needs confirming against the real API rather than taken on faith.
- Live hike/bike search and a live transit-connections lookup from an `/es` session — confirm both return usable English-language results (not blank, not an error) rather than silently breaking.
- `<link rel="alternate" hreflang="es">` appears in page `<head>` alongside the existing four.
- `sitemap.xml`/`robots.txt` post-build include `/es/...` entries.
- Explore Trips filter: selecting the "Es" review-language option actually filters to Spanish-detected reviews.
- Trigger an English-source edit on a curated trip; confirm `reviewTranslations.es`/`nameTranslations.es` populate.

---

## References

- @frontend/src/app/shared/services/lang.ts
- @frontend/src/app/shared/services/i18n-loader.ts
- @frontend/public/i18n/en.json
- @frontend/public/i18n/de.json
- @frontend/public/i18n/fr.json
- @frontend/public/i18n/it.json
- @frontend/src/app/shell/menu-nav/menu-nav.ts
- @frontend/src/app/shell/desktop-notice/desktop-notice.ts
- @frontend/scripts/generate-sitemap.mjs
- @frontend/src/app/shared/services/seo.ts
- @frontend/src/app/core/guards/locale.ts
- @backend/src/utils/translate.js
- @backend/src/utils/detect-lang.js
- @backend/src/models/Trip.js
- @frontend/src/app/models/trip.ts
- @frontend/src/app/shared/utils/localized-text.ts
- @frontend/src/app/features/explore-trips/explore-trips-filter/explore-trips-filter.ts
- @frontend/src/app/features/auth/profile/profile.ts (`localeTabs` — no change needed, confirms the pattern)
- @backend/src/utils/ojp.js
- @backend/src/utils/schweizMobilRoutes.js
- @backend/src/utils/aiTools.js
- @backend/src/utils/myswitzerland.js
- @backend/src/controllers/myswitzerland.js
- @context/features/trip-content-translation-spec.md
- @context/features/seo-locale-routing-hreflang-spec.md
