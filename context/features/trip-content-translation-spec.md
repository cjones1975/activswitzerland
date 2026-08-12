# Trip Content Translation (Claude API)

## Goal

Curated public trips (the "ActivSwitzerland Team" account, per the trip-detail-pages feature) currently have
`name`/`review` written once, in English only. Every locale of a trip's `/trips/:slug` page — `/de`, `/fr`,
`/it` — therefore shows the same English text, which is both a poor visitor experience and undermines the
SEO goal the trip-detail pages exist for (each locale's page has no genuinely localized content to rank on).
This spec adds automatic translation via the Claude API, triggered **only for the curator account** (not
every user who makes a trip public — see Confirmed Decisions), with the translated text stored alongside
the English original and surfaced for the curator to glance at/edit before treating it as final.

Separately, since regular users' public trips keep their review in whatever language they wrote it in
(un-translated), this spec also adds a lightweight, free (non-API) language detection pass on **every**
public trip's review, so Explore Trips can offer a "filter by review language" control — letting a visitor
browsing in French, say, see only reviews they can actually read.

## Current state (verified against the code, not assumed)

- `backend/src/models/Trip.js`: `name` (required string) and `review` (string, default `''`) are single,
  un-localized fields. No translation concept exists anywhere in the codebase.
- `backend/package.json`: no `@anthropic-ai/sdk` dependency — needs adding.
- Nothing in `backend/config/.env` / `infra/.env.prod.example` references an Anthropic API key — this is a
  new credential the user needs to provision (an Anthropic Console API key), separate from Claude Code's own
  auth.
- `frontend/src/app/features/trip-detail/trip-detail.ts` (`buildDescription()`) and
  `frontend/src/app/features/explore-trips/trip-card/trip-card.html` both read `trip.name`/`trip.review`
  directly, as plain strings, with no locale awareness.
- `frontend/src/app/features/auth/profile/profile.ts`/`.html` already has an in-place edit pattern for
  `review` (`editingReviewId`/`reviewDraft`/`startEditReview()`/`saveReview()`,
  [profile.ts:59-60](frontend/src/app/features/auth/profile/profile.ts#L59-L60),
  [profile.ts:214-229](frontend/src/app/features/auth/profile/profile.ts#L214-L229)) — no equivalent exists
  for `name` (`trip.name` is rendered read-only, [profile.html:156](frontend/src/app/features/auth/profile/profile.html#L156)).
  This existing pattern is the template to extend, not replace, for reviewing translations.
- `SeoService.setHreflang()` ([seo.ts:83-90](frontend/src/app/shared/services/seo.ts#L83-L90)) already
  unconditionally emits `/en|de|fr|it` alternate links for every page, trip-detail included — this was
  flagged earlier as technically inaccurate while every locale showed identical English text. Once real
  per-locale content exists (this spec), that claim becomes true as a side effect — no `SeoService` code
  change is needed.
- Stop names (`TripStop.name`) and activity names (`TripActivitySelection.name`) are real place/POI names
  sourced from OJP/MySwitzerland — explicitly **not** translated by this spec, matching the earlier decision
  that only authored prose (`name`, `review`) needs localization.
- No concept of a "curator"/admin role exists anywhere (`backend/src/models/User.js` has no role field, per
  earlier research) — the "ActivSwitzerland Team" account is just a normal registered user. Restricting
  translation to it needs an explicit, external identifier (an env var holding that one account's Mongo
  `_id`), not a schema/role check.
- `frontend/src/app/features/explore-trips/explore-trips-filter/explore-trips-filter.ts` /`.html`: the
  existing filter drawer, `ExploreTripsFilters` interface (`type`/`order`/`sortByLikes`/`minDistance`/
  `maxDistance`), all built on PrimeNG `p-selectButton`/`p-slider`/`p-toggleswitch` — the template to extend
  for a new "review language" filter, not a new mechanism.
- `backend/src/controllers/trips.js`'s `getPublicTrips` builds `match` as a plain Mongo filter object from
  query params (`type`, `minDistance`/`maxDistance`) before the aggregation — a new `reviewLang` param slots
  into that same `match` object.

## Confirmed decisions (from prior discussion)

1. **Provider: Claude API**, not OpenAI — the user has existing Anthropic access via Claude Code; per the
   `claude-api` skill's defaults, calls use `claude-opus-5` unless the user says otherwise. Flagged as an
   easy knob to revisit (e.g. a cheaper model) once real usage volume is known — not blocking for v1.
2. **Additive data model, not a breaking change to `name`/`review`.** Rather than turning `name`/`review`
   into `{en, de, fr, it}` objects (which would break every existing read site and require migrating
   already-live trips), add new optional `nameTranslations`/`reviewTranslations` fields
   (`{de?, fr?, it?}` — no `en` key, since English is the existing `name`/`review` field itself). Every
   current call site that reads `trip.name`/`trip.review` keeps working unchanged; only the few genuinely
   locale-aware display sites (trip-detail, trip-card) need to resolve through a new helper.
3. **Translate on English-source change, not just first publish.** The curator will keep editing trips after
   publishing (fixing typos, adjusting reviews). Translations regenerate whenever the stored `name` or
   `review` differs from the incoming value on a public trip — not just once at the `isPublic` false→true
   transition (unlike the slug, which is intentionally immutable).
4. **Synchronous translation, not fire-and-forget.** The curator publishes/edits through the same
   trip-planner Step 5 / Profile flow as any user — there's no separate "processing" indicator anywhere in
   that UI. Translating within the save request (a few short sentences, `effort: "low"`, thinking disabled)
   keeps the response predictable: the trip a curator just saved already has its translations when the
   response comes back, ready to glance at immediately.
5. **Review, not blind auto-publish.** Extend Profile's existing review-edit pattern
   (`editingReviewId`/`reviewDraft`) with a locale switcher covering both `name` and `review`, so the
   curator can see and hand-edit any locale's auto-translated text — reusing the existing edit-in-place UI
   rather than building a new one.
6. **Translation failure never blocks the save.** If the Claude API call errors, times out, or returns a
   refusal, the trip still saves with whatever translations already existed (or none) — the display layer
   already falls back to English per-locale, so a failed translation degrades gracefully rather than losing
   the save.
7. **Claude-based translation is restricted to one account.** Only trips whose `user` matches a configured
   `CURATED_TRIPS_USER_ID` (the "ActivSwitzerland Team" account's Mongo `_id`, set in `.env`) trigger a
   translation call. Every other user's public trip keeps its `review` exactly as written, in whatever
   language that was — this is what keeps the Claude API cost bounded to the curator's own publishing pace,
   not the app's whole user base.
8. **Every public trip gets a detected (not translated) review language, regardless of account.** A cheap,
   local, non-API language-detection pass runs on every public trip's `review` (or `name` if `review` is
   empty) so Explore Trips can offer a "filter by review language" control that works for all trips, not
   just curated ones. This is deliberately a different mechanism from Decision 7's Claude-based translation
   — detection has no meaningful per-call cost, so it isn't scoped to one account the way translation is.
9. **A curated trip's detected language is `en`, hardcoded, not run through the detector.** Its source is
   always English by construction (the curator writes it), so detection would be redundant work for a
   result that's already known.

## Assumptions flagged for review

1. **What gets sent as source text**: the full `name` and `review` strings, translated independently (two
   fields in one request, one JSON response) rather than one call per locale per field (would be 6 calls
   instead of 1) — cheaper and faster, and there's no cross-field context Claude would lose by batching them.
2. **Stop-name/place-name leakage**: since `review` is free text, a curator might reference a stop by name
   inside it (e.g. "the hike from Zermatt was the highlight"). The translation prompt explicitly instructs
   Claude to keep proper nouns (place names, trail names) untranslated/unchanged — flagged since this is a
   prompt-engineering judgment call, not a hard guarantee.
3. **No retry/backoff beyond the SDK's built-in default (`max_retries: 2`)** — a transient failure degrades
   to "no translation yet" per Confirmed Decision 6, rather than the save request hanging on manual retries.
4. **Language detection uses a local library (`franc`), not an API call** — free, deterministic, no network
   dependency, matching Decision 8's requirement that it scale to every user at zero marginal cost. `franc`
   is unreliable on very short text (a one-sentence review); results below a rough confidence/length
   threshold fall back to an `'other'` bucket rather than guessing — flagged since this means some genuinely
   English/German/French/Italian short reviews will land in `'other'` and not be filterable by their real
   language. Acceptable for a first pass; a fast-follow could re-detect using the fuller `name + review`
   text or lower the threshold once real data shows how often this happens.
5. **A curated trip matches a language filter it has a translation for, not just its detected `en`.** E.g. a
   curated trip filtered for `fr` should appear, because a real French version of it exists
   (`reviewTranslations.fr`) — even though its own `reviewLang` is `en`. This needs an `$or` in the filter
   query (`reviewLang === lang` OR `reviewTranslations[lang]` exists) rather than a single equality check —
   flagged as slightly more query complexity than a naive implementation, but it's what actually serves the
   stated goal ("show me trips I can read in my language").

## Data model changes

### Backend — `backend/src/models/Trip.js`

```js
const TripSchema = new mongoose.Schema({
    // ...existing fields unchanged...
    nameTranslations: {
        de: String, fr: String, it: String,
    },
    reviewTranslations: {
        de: String, fr: String, it: String,
    },
    // Detected (not translated) source language of `review`/`name`, for the Explore Trips language
    // filter — set on every public trip regardless of account (Confirmed Decision 8), 'en' hardcoded
    // for curated trips (Confirmed Decision 9).
    reviewLang: {
        type: String, enum: ['en', 'de', 'fr', 'it', 'other'],
    },
});
```

Plain optional strings — no separate sub-schema needed, mirrors how `range`/other nested-but-simple fields
are declared elsewhere in this file.

### Backend — `@anthropic-ai/sdk` + `franc` dependencies

```sh
cd backend && npm install @anthropic-ai/sdk franc
```

`franc` is ESM-only, matching this backend's `"type": "module"` — no interop shim needed.

### Backend — `backend/src/utils/detect-lang.js` (new)

```js
import { francAll } from 'franc';

// franc's ISO 639-3 codes -> this app's SUPPORTED_LANGS.
const ISO_639_3_TO_APP_LANG = { eng: 'en', deu: 'de', fra: 'fr', ita: 'it' };
const MIN_TEXT_LENGTH = 20; // below this, franc's guesses are unreliable — bucket as 'other'

/** Best-effort detection for the Explore Trips language filter — never throws, always returns a value. */
export function detectReviewLang(text) {
    const trimmed = (text ?? '').trim();
    if (trimmed.length < MIN_TEXT_LENGTH) return 'other';
    const [topGuess] = francAll(trimmed, { minLength: MIN_TEXT_LENGTH });
    const appLang = topGuess && ISO_639_3_TO_APP_LANG[topGuess[0]];
    return appLang ?? 'other';
}
```

### Backend — `.env`: curator account identifier

```
# backend/config/.env — the "ActivSwitzerland Team" account's Mongo _id; only this account's
# public trips get Claude-translated (see trip-content-translation-spec.md)
CURATED_TRIPS_USER_ID=<paste the account's _id here>
```

Find the id once via `db.users.findOne({ email: '<team account email>' })._id` (or the equivalent
Mongo Express / `mongosh` lookup) and paste it in — no code needed to look it up dynamically.

### Backend — `backend/src/utils/translate.js` (new)

```js
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const TARGET_LANGS = { de: 'German', fr: 'French', it: 'Italian' };

// Translates name/review from English into de/fr/it in one call. Returns null (not a partial
// object) on any failure — callers must treat "no translation yet" and "translation failed" the
// same way: keep whatever was already stored, don't block the save.
export async function translateTripContent({ name, review }) {
    try {
        const response = await client.messages.create({
            model: 'claude-opus-5',
            max_tokens: 2048,
            thinking: { type: 'disabled' },
            output_config: {
                effort: 'low',
                format: {
                    type: 'json_schema',
                    schema: {
                        type: 'object',
                        properties: {
                            de: { type: 'object', properties: { name: { type: 'string' }, review: { type: 'string' } }, required: ['name', 'review'] },
                            fr: { type: 'object', properties: { name: { type: 'string' }, review: { type: 'string' } }, required: ['name', 'review'] },
                            it: { type: 'object', properties: { name: { type: 'string' }, review: { type: 'string' } }, required: ['name', 'review'] },
                        },
                        required: ['de', 'fr', 'it'],
                        additionalProperties: false,
                    },
                },
            },
            messages: [{
                role: 'user',
                content: `Translate this Swiss travel itinerary's title and traveller review into German, French, and Italian.
Keep place names, trail names, and other proper nouns unchanged. Keep the tone natural and concise, matching
the original. If the review is empty, return an empty string for review in every language.

Title: ${name}
Review: ${review || '(none)'}`,
            }],
        });

        if (response.stop_reason === 'refusal') return null;
        const text = response.content.find(b => b.type === 'text')?.text;
        if (!text) return null;
        const parsed = JSON.parse(text);
        return {
            nameTranslations: { de: parsed.de.name, fr: parsed.fr.name, it: parsed.it.name },
            reviewTranslations: { de: parsed.de.review, fr: parsed.fr.review, it: parsed.it.review },
        };
    } catch {
        return null; // network/API error — degrade gracefully, per Confirmed Decision 6
    }
}
```

### Backend — `controllers/trips.js`

- `createTrip`: after building the trip payload, if `isPublic` is true:
  - Set `reviewLang`: `req.user.id === process.env.CURATED_TRIPS_USER_ID ? 'en' : detectReviewLang(review || name)`
    (Confirmed Decisions 8–9) — runs unconditionally on every public trip.
  - Only if `req.user.id === process.env.CURATED_TRIPS_USER_ID` (Confirmed Decision 7), additionally call
    `translateTripContent({ name, review })` and spread the result (if non-null) into the create payload.
- `updateTrip`: fetch `trip` already happens first. Before the `findByIdAndUpdate` call: if the effective
  `isPublic` (updated value or existing) is true and either `updates.name` or `updates.review` is present:
  - Recompute `updates.reviewLang` the same way (curator → `'en'`, everyone else → `detectReviewLang(...)`
    on the effective, updated-or-existing review/name).
  - Only for the curator account, and only when the effective `name`/`review` actually differs from what's
    currently stored, call `translateTripContent()` and spread the result into `updates`.
  Client-supplied `nameTranslations`/`reviewTranslations`/`reviewLang` are stripped from the body first
  (server-derived only, same pattern as `likes`/`slug`).
- `getPublicTrips`: accept a new `reviewLang` query param (`'en'|'de'|'fr'|'it'|'other'`, optional). When
  present, extend `match` with:
  ```js
  if (reviewLang) {
      match.$or = [
          { reviewLang },
          ...(['de', 'fr', 'it'].includes(reviewLang) ? [{ [`reviewTranslations.${reviewLang}`]: { $exists: true, $ne: null } }] : []),
      ];
  }
  ```
  (see Assumption 5 for why curated trips need the second branch).

### Backend — `.env` / infra

- `backend/config/.env`: add `ANTHROPIC_API_KEY=` (the user provisions the actual key — an Anthropic Console
  API key, separate from any Claude Code auth) and `CURATED_TRIPS_USER_ID=` (see above).
- `infra/.env.prod.example`: add both keys as documented-but-empty template entries; the real values go in
  the NAS's own `infra/.env.prod` (never committed), same convention as every other secret there.
- `infra/docker-compose.prod.yml`: pass both `ANTHROPIC_API_KEY` and `CURATED_TRIPS_USER_ID` through to the
  `backend` service's environment, same as existing secrets.

### Frontend — `shared/utils/localized-text.ts` (new)

```ts
import { Lang } from '../services/lang';

export interface LocalizableTrip {
  name?: string;
  review?: string;
  nameTranslations?: { de?: string; fr?: string; it?: string };
  reviewTranslations?: { de?: string; fr?: string; it?: string };
}

export function localizedName(trip: LocalizableTrip, lang: Lang): string {
  if (lang === 'en') return trip.name ?? '';
  return trip.nameTranslations?.[lang] || trip.name || '';
}

export function localizedReview(trip: LocalizableTrip, lang: Lang): string {
  if (lang === 'en') return trip.review ?? '';
  return trip.reviewTranslations?.[lang] || trip.review || '';
}
```

Falls back to English whenever a specific locale's translation is missing or empty (covers "not yet
translated" and "translation failed" identically, per Confirmed Decision 6).

### Frontend — `models/trip.ts`

```ts
export interface SavedTrip extends PlannedTrip {
  // ...existing fields unchanged...
  nameTranslations?: { de?: string; fr?: string; it?: string };
  reviewTranslations?: { de?: string; fr?: string; it?: string };
}
```

(`PublicTrip` inherits via `extends Omit<SavedTrip, 'likes'>` — no separate change.)

## Phase A — Backend: translation (curator-only) + language detection (everyone)

**Branch:** `feature/trip-content-translation`

- `Trip.js` schema fields (`nameTranslations`/`reviewTranslations`/`reviewLang`), `utils/translate.js`,
  `utils/detect-lang.js`, `controllers/trips.js` wiring (account gate + detection + the `getPublicTrips`
  filter param), `.env`/infra additions — all as described above.
- `getPublicTrips`/`getTripBySlug` already spread `...trip`/`...rest` — the new fields flow through to the
  API response with no further controller change needed there.

### Verification plan

- `node --check` on changed files.
- Live, as the curator account: publish a new trip with `name`/`review` set → confirm
  `nameTranslations`/`reviewTranslations` are populated with plausible German/French/Italian text
  (spot-check by eye, not automated — translation quality isn't unit-testable), and `reviewLang` is `'en'`.
- Live, as the curator account: edit an already-public trip's `review` only → confirm both translation
  objects regenerate to match the new text (not just `reviewTranslations`, since the prompt sends both
  fields together — verify `name`'s translations don't spuriously change if `name` itself didn't).
- Live, as the curator account: temporarily break `ANTHROPIC_API_KEY` (wrong value) → confirm the trip still
  saves successfully with no translations, and no 500.
- **Live, as a non-curator account**: publish a public trip with a German review → confirm
  `nameTranslations`/`reviewTranslations` stay unset (no Claude call made — check for the outbound request
  via a temporary log line, not just the DB result) and `reviewLang` is `'de'`.
- Live: publish a public trip (non-curator) with a very short review (a few words) → confirm `reviewLang`
  lands in `'other'` rather than a wrong guess (per Assumption 4's length threshold).
- Confirm a private trip's `name`/`review` edits trigger **neither** translation nor detection, regardless
  of account.
- `curl GET /trips/public?reviewLang=fr` → confirm it returns both French-reviewed regular trips and
  curated (English-source) trips that have an `fr` translation, and excludes everything else.

## Phase B — Frontend: display translated content

**Branch:** same as Phase A, or split at the user's discretion once Phase A is verified — small enough to
likely land together.

- `models/trip.ts`, `shared/utils/localized-text.ts` as above.
- `features/trip-detail/trip-detail.ts`: `LangService` already injected as `protected langSvc`. Replace
  direct `trip.name`/`trip.review` reads (in `buildDescription()` and anywhere else the component reads
  them) with `localizedName(trip, this.langSvc.current)` / `localizedReview(trip, this.langSvc.current)`.
  `seo.set({ title })` and the `TouristTrip` JSON-LD `name`/`description` both use the localized name —
  this is the change that actually makes the SEO investment pay off per-locale.
- `features/trip-detail/trip-detail.html`: `<h1>{{ trip.name }}</h1>` → `<h1>{{ localizedName(trip, ...) }}</h1>`
  (expose the two functions as component properties, same pattern as `formatDistance` in trip-card.ts).
- `features/explore-trips/trip-card/trip-card.ts`/`.html`: same substitution for `tc-name` and
  `tc-review-text`. `trip-card` doesn't currently inject `LangService` — add it (read-only, like
  `trip-detail`'s usage).

### Verification plan

- `tsc --noEmit`.
- Live: view a translated trip's `/de/trips/:slug`, `/fr/trips/:slug`, `/it/trips/:slug` pages → confirm
  the `<h1>`, meta description, and JSON-LD `name`/`description` all show the translated text, not English.
- Live: view the same trip's card on `/de/explore-trips` (switch site language) → confirm the card's name
  and review text are also localized.
- Live: view a trip that has no translations yet (e.g. one saved before this feature shipped) on a non-English
  locale → confirm it falls back to English cleanly, no blank/undefined text.

## Phase C — Frontend: Profile review/edit UI for translations

**Branch:** same as above, or its own branch once B is verified — this is the smallest, most deferrable
phase if time-boxing is needed.

- `features/auth/profile/profile.ts`: extend the existing `editingReviewId`/`reviewDraft` pair with a
  `reviewEditLocale = signal<Lang>('en')` (or similar) driving which of `review`/`reviewTranslations.de/fr/it`
  the textarea reads/writes; `saveReview()` calls `updateTrip(trip._id!, { review: ... })` for `en`, or
  `{ reviewTranslations: { ...trip.reviewTranslations, [locale]: draft } }` for the other three — a direct
  field patch, not a re-translation (editing a locale's stored text overrides that locale's translation
  without re-triggering Phase A's regeneration logic, since the English source didn't change).
- Add an equivalent, new edit-in-place affordance for `name` (doesn't exist today at all) using the same
  locale-switcher pattern — smallest version: a pencil-icon button next to `trip-card-name` that opens the
  same kind of inline textarea/input the review section already uses.
- `profile.html`: small locale-tab strip (`EN | DE | FR | IT`) above the review textarea and the new name
  editor, four plain buttons toggling the local `reviewEditLocale`/equivalent signal — no new dependency,
  matches the existing plain-button UI conventions already in this file.

### Verification plan

- `tsc --noEmit`.
- Live: open a public trip's review editor in Profile, switch to German, confirm the auto-translated German
  review shows; edit it, save, reload → confirm the edit persisted and didn't get overwritten by a
  re-translation.
- Live: repeat for `name`.
- Live: confirm switching locale tabs before saving doesn't lose an in-progress unsaved edit in another
  locale (or, simpler acceptable behavior: confirm it's obvious to the curator that switching discards the
  current draft, if that's the simpler implementation chosen) — flagged as a UX detail to settle during
  implementation, not before.

## Phase D — Frontend: Explore Trips "filter by review language"

**Branch:** same as above, or its own — independent of Phases B/C (different part of the UI, applies to all
trips not just curated ones), could ship before or after them.

- `shared/services/explore-trips.ts`: `ExploreTripsFilter` interface gains `reviewLang?: 'all' | 'en' | 'de' | 'fr' | 'it' | 'other'`;
  `getPublicTrips()` adds it to the `HttpParams` (omitted when `'all'`, matching the existing `type` param's
  convention).
- `features/explore-trips/explore-trips-filter/explore-trips-filter.ts`: extend `ExploreTripsFilters` with
  the same `reviewLang` field (default `'all'`, added to `DEFAULT_EXPLORE_TRIPS_FILTERS`); new
  `reviewLangOptions` array (`['all', 'en', 'de', 'fr', 'it', 'other']`) and a `reviewLang` signal, following
  the exact pattern `type`/`typeOptions` already use.
- `explore-trips-filter.html`: one more `<div class="etf-field">` block with a `p-selectButton`, identical
  shape to the existing trip-type filter block.
- `features/explore-trips/explore-trips.ts`: thread `filters().reviewLang` into the `getPublicTrips()` call
  alongside the existing `type`/`sort`/`order`/`minDistance`/`maxDistance` params (`loadMore()` already
  builds this params object).
- i18n (`exploreTrips.filter` namespace, en/de/fr/it): `reviewLang` (field label, e.g. "Review language"),
  and `reviewLangOption.{all,en,de,fr,it,other}` for the button labels (`all` reuses the existing "All"
  wording style from `type.all`; `other` reads as "Other language(s)").

### Verification plan

- `tsc --noEmit`.
- Live: open the Explore Trips filter drawer → confirm the new language selector appears and behaves like
  the existing trip-type selector (single-select, `allowEmpty=false`).
- Live: filter by each language in turn against a mix of curated and regular trips seeded with different
  `reviewLang` values → confirm the result set matches what Assumption 5 describes (curated trips appear
  under every language they have a translation for, regular trips only under their detected language).
- Live: confirm Reset clears the language filter back to `'all'` alongside the other filters, and that
  reopening the drawer after Apply shows the last-applied language selection (matches the drawer's existing
  seed-from-current-payload behavior).

## Out of scope

- Translating stop names, activity names, or any other place/POI-sourced text — confirmed non-goal.
- A dedicated translation-review queue/approval workflow separate from the existing Profile edit surface.
- Any provider other than Claude (OpenAI was considered and explicitly not chosen).
- Retrying/backfilling translations, or `reviewLang` detection, for trips published before this feature
  ships automatically — an edit through the normal save flow will trigger both (Confirmed Decision 3), which
  is enough of a backfill path given the small number of trips involved. Existing trips simply won't appear
  under any specific language filter (`reviewLang` absent) until then — acceptable since the filter itself
  is new.
- A real admin/role system on the `User` model. Restricting translation to the curator account uses a
  single env var (`CURATED_TRIPS_USER_ID`) rather than a `role`/`isAdmin` field — fine for exactly one
  curated account; revisit if a second curator is ever added.

## References

- @backend/src/models/Trip.js
- @backend/src/controllers/trips.js
- @backend/package.json
- @backend/config/.env
- @infra/.env.prod.example
- @infra/docker-compose.prod.yml
- @frontend/src/app/models/trip.ts
- @frontend/src/app/features/trip-detail/trip-detail.ts
- @frontend/src/app/features/explore-trips/trip-card/trip-card.ts
- @frontend/src/app/features/auth/profile/profile.ts
- @frontend/src/app/features/auth/profile/profile.html
- @frontend/src/app/features/explore-trips/explore-trips-filter/explore-trips-filter.ts
- @frontend/src/app/features/explore-trips/explore-trips-filter/explore-trips-filter.html
- @frontend/src/app/features/explore-trips/explore-trips.ts
- @frontend/src/app/shared/services/explore-trips.ts
- @frontend/src/app/shared/services/seo.ts
- `context/features/trip-detail-pages-spec.md` (the SEO pages this directly improves)
- `context/deployment-plan.md` (where the new `ANTHROPIC_API_KEY` secret needs to be added on deploy)
