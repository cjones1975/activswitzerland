# Image Copyright Compliance (expand=true + no_image fallback + galleria caption)

## Overview

MySwitzerland's terms & conditions require that any image without a named `copyrightHolder` not be displayed. Today every query sends `expand=false` (or omits `expand`), so list responses only ever get the bare `photo` string with no attribution metadata to check at all. Live testing against the API confirms the problem is real: across a sample of 213 images, 46% had no `copyrightHolder` field.

Three changes:

1. Request `expand=true` everywhere, and strip non-compliant images server-side so the frontend never even receives one.
2. List cards (destinations + attractions) fall back to `no_image.png` when no compliant image remains; detail pages show no image section at all in that case.
3. Detail-page galleria images get a `© {{name}}` caption overlay.

Key finding: `expand` only changes behaviour on the *list* endpoints. The single-record endpoints (`/attractions/:id`, `/destinations/:id`) already return the full `image[]` array with `copyrightHolder` regardless of `expand` — confirmed live for `getDestination` (identical `image` data with/without the param); `getAttraction` already hardcodes `expand=true`. So `getDestination` gets `expand=true` added for explicitness/future-proofing only, not because it changes its output.

Compliance rule: an image is displayable if `copyrightHolder` is present and non-empty after trimming. No attempt is made to judge the *quality* of the string — generic values like "Editorial and touristic use" or "Full buy-out (no restrictions)" count as compliant, same as a real photographer credit.

`encodingFormat` (MIME type, e.g. `image/jpeg`) is not used anywhere in this change — every image renders via CSS `background-image: url(...)`, which doesn't need a MIME hint, and only `image/jpeg`/`image/png` were observed in sampled data. Not worth plumbing through for a hypothetical future format allowlist.

---

## 1. Backend: always expand, strip non-compliant images server-side

`@backend/src/controllers/myswitzerland.js`:

- Add compliance helpers alongside the existing `hasValidGeo`/`stripInvalidGeo`. Response shape differs between list endpoints (`response.data.data` is an array) and single-record endpoints (`response.data.data` is one object), so the stripper needs to handle both:

```javascript
const hasNamedCopyright = (img) => typeof img?.copyrightHolder === 'string' && img.copyrightHolder.trim().length > 0;

const stripNonCompliantImages = (record) => {
  if (Array.isArray(record?.image)) {
    record.image = record.image.filter(hasNamedCopyright);
  }
};

const stripNonCompliantImagesFromResponse = (response) => {
  const data = response.data?.data;
  if (Array.isArray(data)) {
    data.forEach(stripNonCompliantImages);
  } else if (data) {
    stripNonCompliantImages(data);
  }
};
```

- Call `stripNonCompliantImagesFromResponse(response)` in all seven handlers: `getDestinations`, `getDestinationsByGeobBox`, `getDestination`, `searchDestinations`, `getAttraction`, `getAttractions`, `searchAttractions` (alongside the existing `stripInvalidGeo(response)` call where present).
- Replace `expand=${req.query.expand}` with a hardcoded `expand=true` in `getDestinations`, `getDestinationsByGeobBox`, `searchDestinations`, `getAttractions`, `searchAttractions` — no caller needs to control this anymore, so drop the passthrough entirely.
- Add `&expand=true` to `getDestination`'s URL (currently omits `expand` altogether):

```javascript
url: `${process.env.MYS_ENDPOINT}/v1/destinations/${id}?lang=${req.query.language}&expand=true&striphtml=${req.query.stripHtml}`,
```

- `getAttraction` already hardcodes `expand=true` — unchanged.

---

## 2. Shared image model

New file `@frontend/src/app/models/mys-image.ts`:

```typescript
export interface MysImage {
  '@type'?: string;
  url: string;
  name?: string;
  keywords?: string;
  encodingFormat?: string;
  width?: number;
  height?: number;
}
```

No `copyrightHolder` field needed client-side — the backend never sends a non-compliant image, so there's nothing left to check downstream.

`@frontend/src/app/models/destination.ts`: delete the local `DestinationImage` interface, import `MysImage` instead, change `image?: DestinationImage[]` to `image?: MysImage[]`.

`@frontend/src/app/models/attraction.ts`: change `image?: { url: string }[]` to `image?: MysImage[]` (this upgrades attractions' image data from URL-only to the full shape, needed for the caption feature).

---

## 3. Frontend services: drop the now-pointless `expand` (and dead `top`) parameters

`@frontend/src/app/shared/services/attractions.ts`:

- `getAttractions()`: change the hardcoded `.set('expand', 'false')` to `.set('expand', 'true')`. No signature change (it never took `expand` as a param).
- `searchAttractions()`: remove `expand: boolean` and `top: boolean` from the params type (backend never reads `top` for this endpoint — it's already dead). Hardcode `.set('expand', 'true')`, drop `.set('top', ...)`.

`@frontend/src/app/shared/services/destinations.ts`:

- `getDestinations()`: remove `expand: boolean` from the params type, hardcode `.set('expand', 'true')`.
- `searchDestinations()`: change the hardcoded `.set('expand', 'false')` to `.set('expand', 'true')`. No signature change.

Update call sites to drop the now-removed fields:

- `@frontend/src/app/features/destinations/destination-vertical-list/destination-vertical-list.ts` — remove `expand: false,` from the `getDestinations()` call.
- `@frontend/src/app/features/destinations/destination-horizontal-list/destination-horizontal-list.ts` — remove `expand: false,` from the `getDestinations()` call.
- `@frontend/src/app/features/attractions/all-attractions/all-attractions.ts` — remove `expand: false,` and `top: true,` from the `onSearch()` → `searchAttractions()` call.
- `@frontend/src/app/features/search/attraction-search-results/attraction-search-results.ts` — remove `expand: false,` and `top: false,` from the `fetch()` → `searchAttractions()` call.

---

## 4. List-view image fallback (destinations + attractions)

Replace `.photo` with a compliant-image lookup, falling back to `no_image.png`:

```html
[style.background-image]="'url(' + (record.image?.[0]?.url || '/assets/no_image.png') + ')'"
```

Files (attractions already have the `no_image.png` fallback wired to `.photo` from a prior change — this just repoints the source field to `.image`; destinations get the fallback added for the first time):

- `@frontend/src/app/features/attractions/all-attractions/all-attractions.html` (both card blocks — grid + search-mode)
- `@frontend/src/app/features/attractions/attraction-vertical-list/attraction-vertical-list.html`
- `@frontend/src/app/features/search/attraction-search-results/attraction-search-results.html`
- `@frontend/src/app/features/destinations/destination-vertical-list/destination-vertical-list.html`
- `@frontend/src/app/features/search/destination-search-results/destination-search-results.html`
- `@frontend/src/app/features/destinations/destination-horizontal-list/destination-horizontal-list.html`

---

## 5. Detail pages: compliant-only galleria, no fallback, caption overlay

`@frontend/src/app/features/attractions/attraction-detail/attraction-detail.html` and `@frontend/src/app/features/destinations/destination-detail/destination-detail.html`:

- Remove the `.photo`-based fallback branch entirely. Today both templates show the galleria when `image.length` is truthy, else fall back to a single `.photo` background-image div. Since `.photo` may point at a non-compliant image and the backend now only ever returns compliant images in `image[]`, the fallback branch is deleted — if `image` is empty after filtering, no image section renders at all.

  Attraction detail goes from:
  ```html
  } @else if (fullAttraction()?.image?.length) {
    <div class="galleria-wrap"> ... </div>
  } @else if (p.attraction.photo) {
    <div class="galleria-wrap">
      <div class="galleria-img" [style.background-image]="'url(' + p.attraction.photo + ')'"></div>
    </div>
  }
  ```
  to:
  ```html
  } @else if (fullAttraction()?.image?.length) {
    <div class="galleria-wrap"> ... </div>
  }
  ```
  Same pattern for destination-detail (its `@else` branch using `dest.photo` is removed the same way).

- Add a caption to the galleria's main-image template (`#item`, not `#thumbnail`):

```html
<ng-template #item let-img>
  <div class="galleria-img" [style.background-image]="'url(' + img.url + ')'">
    @if (img.name) {
      <div class="galleria-caption">© {{ img.name }}</div>
    }
  </div>
</ng-template>
```

  Note: `image.name` is used verbatim. It's inconsistent in the source data — sometimes a real caption ("Fribourg, Fryburg 1606"), sometimes a raw filename ("st.jpg") — that's a MySwitzerland data-quality issue, not something to normalize here.

CSS (`@frontend/src/app/features/attractions/attraction-detail/attraction-detail.css` and `@frontend/src/app/features/destinations/destination-detail/destination-detail.css`, both currently have an identical `.galleria-img` rule):

```css
.galleria-img {
  position: relative; /* new — positions the caption */
  width: 100%;
  height: 240px;
  background-size: cover;
  background-position: center;
  border-radius: 10px;
}

.galleria-caption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0.35rem 0.75rem;
  background: rgba(229, 229, 229, 0.85);
  color: var(--gray-700);
  font-size: 0.7rem;
  border-radius: 0 0 10px 10px;
}
```

---

## Out of Scope

- No judgment of `copyrightHolder` *content* — presence/non-empty is the only check, per instruction.
- No i18n changes — the `©` prefix is a symbol, not translated copy.
- Redis cache (`cacheResponse`) keys are `mys:${req.originalUrl}` (the incoming request URL), unaffected by `expand` moving server-side or by the compliance filtering.
- `encodingFormat` is not consumed anywhere (see Overview).

---

## References

- @backend/src/controllers/myswitzerland.js
- @frontend/src/app/models/mys-image.ts (new)
- @frontend/src/app/models/destination.ts
- @frontend/src/app/models/attraction.ts
- @frontend/src/app/shared/services/attractions.ts
- @frontend/src/app/shared/services/destinations.ts
- @frontend/src/app/features/destinations/destination-vertical-list/destination-vertical-list.ts
- @frontend/src/app/features/destinations/destination-horizontal-list/destination-horizontal-list.ts
- @frontend/src/app/features/attractions/all-attractions/all-attractions.ts
- @frontend/src/app/features/attractions/all-attractions/all-attractions.html
- @frontend/src/app/features/attractions/attraction-vertical-list/attraction-vertical-list.html
- @frontend/src/app/features/search/attraction-search-results/attraction-search-results.ts
- @frontend/src/app/features/search/attraction-search-results/attraction-search-results.html
- @frontend/src/app/features/destinations/destination-vertical-list/destination-vertical-list.html
- @frontend/src/app/features/search/destination-search-results/destination-search-results.html
- @frontend/src/app/features/destinations/destination-horizontal-list/destination-horizontal-list.html
- @frontend/src/app/features/attractions/attraction-detail/attraction-detail.html
- @frontend/src/app/features/attractions/attraction-detail/attraction-detail.css
- @frontend/src/app/features/destinations/destination-detail/destination-detail.html
- @frontend/src/app/features/destinations/destination-detail/destination-detail.css
