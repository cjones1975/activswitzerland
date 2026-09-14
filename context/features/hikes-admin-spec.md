# Hikes Admin

## Overview

Two things, built together:

1. A `hikes` MongoDB collection so custom GPX-sourced hikes can be added alongside the existing live `ch.astra.wanderland` (SchweizMobil) routes, merged transparently into the same `/api/v1/hikes` / `/api/v1/hikes/search` responses the frontend already consumes. Every custom hike is single-stage, `category: 'local'`, and carries `source: 'loisirs.ch'` — ASTRA-derived routes now carry `source: 'SwitzerlandMobility'` for the same field, so the merged shape is consistent regardless of origin.
2. A single-admin-only `/admin` section in the existing Angular app (not a separate app) that lets the account owner add/rename/delete these hikes: paste a GPX, see a live map + computed stats before saving, no code changes required per hike going forward. Gating reuses the existing single-hardcoded-account pattern already used for curated trips (`CURATED_TRIPS_USER_ID`) rather than introducing a role system for one person. The sidebar shell is deliberately built to hold more sections later (a login/chat-message admin view is a known future need) — only "Hikes" is wired up in this pass; the shell has room for siblings, nothing more.

GPX is sent to the backend as plain text in a JSON body (`{ name, gpx }`), not a multipart upload — the frontend reads the file client-side (`File.text()`) before submitting. This avoids adding `multer` as a new dependency; `express.json({ limit: '10mb' })` is already mounted globally in `server.js` and a hiking GPX is a few hundred KB at most.

Out of scope, deliberately: see "Out of Scope" at the end.

---

## 1. `Hike` model

New collection for custom hikes. Mirrors the frontend's `TrailRoute`/`TrailStage` shape closely enough that no translation layer is needed beyond a thin mapper (§3).

`@backend/src/models/Hike.js` (new):

```javascript
import mongoose from 'mongoose';

const HikePointSchema = new mongoose.Schema({
    name: String,
    lat: Number,
    lon: Number,
    elevation: Number,
}, { _id: false });

// One line per <trkseg> in the source GPX - kept as separate lines (not flattened) so a track
// with a real gap/discontinuity still renders correctly, matching the ASTRA MultiLineString
// convention (see schweizMobilRoutes.js's getLines/reprojectGeometry). Custom hikes are always
// single-stage for now (see Overview), so `stages` always has exactly one entry.
const HikeStageSchema = new mongoose.Schema({
    stageId:       { type: String, required: true },
    stageNumber:   { type: Number, required: true, default: 1 },
    title:         { type: String, default: '' },
    geometry:      { type: mongoose.Schema.Types.Mixed, required: true }, // MultiLineString, LV95 meters
    geometryWgs84: { type: mongoose.Schema.Types.Mixed, required: true }, // MultiLineString, lon/lat
}, { _id: false });

const HikeSchema = new mongoose.Schema({
    // "custom-" prefix guarantees no collision with real ASTRA route numbers, which are bare
    // digits (see getRouteCategory in schweizMobilRoutes.js). Generated at ingestion, never
    // user-supplied - see generateRouteNumber in utils/customHikes.js.
    routeNumber:   { type: String, required: true, unique: true },
    name:          { type: String, required: true, trim: true },
    category:      { type: String, enum: ['national', 'regional', 'local'], default: 'local' },
    isMultiDay:    { type: Boolean, default: false },
    distanceKm:    { type: Number, required: true },
    distanceMiles: { type: Number, required: true },
    stages:        { type: [HikeStageSchema], required: true },
    // Computed at ingestion from the GPX's own <ele> values (utils/customHikes.js#parseGpx) and
    // stored so the admin list can show them without recomputing - the public hike-detail
    // elevation chart keeps using the existing geo.admin.ch DEM endpoint unchanged (see §3), so
    // these fields are for the admin UI only right now.
    ascentM:       Number,
    descentM:      Number,
    minElevation:  Number,
    maxElevation:  Number,
    startPoint:    HikePointSchema,
    endPoint:      HikePointSchema,
    source:        { type: String, default: 'loisirs.ch' },
    createdAt:     { type: Date, default: Date.now },
});

export default mongoose.model('Hike', HikeSchema);
```

---

## 2. GPX parsing utility

`fast-xml-parser` and `proj4` are already dependencies (used by AI translation/`franc` and `schweizMobilRoutes.js` respectively) - no new packages needed.

`@backend/src/utils/schweizMobilRoutes.js` - two small additions, both purely additive:

- Export the existing internal `linesDistanceMeters` (currently unexported) so the new util can reuse the exact same distance math ASTRA routes use:

```javascript
export function linesDistanceMeters(lines) {
```

- Add the inverse of the existing `reprojectCoord` (which goes LV95 → WGS84), since GPX coordinates arrive as lon/lat and need to become LV95 for storage/distance consistency with ASTRA routes:

```javascript
// Inverse of reprojectCoord: WGS84 (GPX's native lon/lat) -> LV95 meters. EPSG:4326 needs no
// explicit proj4.defs() call - it's one of proj4's built-in well-known definitions.
export function reprojectToLv95([lon, lat]) {
    return proj4('EPSG:4326', 'EPSG:2056', [lon, lat]);
}
```

- `source` field on ASTRA-derived routes, so the merged shape (§3) is consistent regardless of origin. In `buildRoutesFromFeatures`'s return (the object mapped from `routes`):

```javascript
    return routes.map(route => {
        const distanceMeters = route.stages.reduce(
            (sum, stage) => sum + linesDistanceMeters(stage.geometry.coordinates),
            0
        );
        const distanceKm = distanceMeters / 1000;

        return {
            routeNumber: route.routeNumber,
            name: route.name,
            category: route.category,
            isMultiDay: !!route.hasSegment,
            totalStages: totalStagesByRoute.get(route.routeNumber),
            distanceKm,
            distanceMiles: distanceKm * 0.621371,
            source: 'SwitzerlandMobility',
            stages: route.stages.map(stage => ({
                ...stage,
                geometryWgs84: reprojectGeometry(stage.geometry),
            })),
        };
    });
```

  and the same `source: 'SwitzerlandMobility',` line added to `fetchRouteStages`'s return object.

`@backend/src/utils/customHikes.js` (new) - parsing, id generation, and the near-point/search queries the merge (§3) needs:

```javascript
import { XMLParser } from 'fast-xml-parser';
import Hike from '../models/Hike.js';
import { reprojectToLv95, linesDistanceMeters } from './schweizMobilRoutes.js';

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

// Same noise floor as fetchElevationProfile in schweizMobilRoutes.js - summing every raw
// trackpoint-to-trackpoint delta wildly overcounts gain/loss from GPS/DEM noise.
const ELEVATION_NOISE_THRESHOLD_M = 0.5;

function asArray(value) {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
}

function parsePoint(pt) {
    return [parseFloat(pt.lon), parseFloat(pt.lat), pt.ele != null ? parseFloat(pt.ele) : null];
}

// Parses a GPX document into everything a Hike document needs: one MultiLineString stage (every
// <trkseg> becomes its own line - the ASTRA convention for a route with gaps, see getLines in
// schweizMobilRoutes.js), distance (LV95, same math as ASTRA routes), elevation stats computed
// directly from the GPX's own <ele> values (no geo.admin.ch DEM call - faster, and works outside
// Switzerland too), and the first/last named waypoints as start/end points if present.
export function parseGpx(gpxString) {
    let doc;
    try {
        doc = xmlParser.parse(gpxString);
    } catch {
        throw new Error('Could not parse GPX file');
    }

    const gpx = doc?.gpx;
    if (!gpx) throw new Error('Not a valid GPX file');

    const lines = [];
    for (const trk of asArray(gpx.trk)) {
        for (const seg of asArray(trk.trkseg)) {
            const points = asArray(seg.trkpt).map(parsePoint);
            if (points.length >= 2) lines.push(points);
        }
    }
    if (!lines.length) throw new Error('GPX file has no usable track segments');

    const lv95Lines = lines.map(line => line.map(([lon, lat]) => reprojectToLv95([lon, lat])));
    const distanceKm = linesDistanceMeters(lv95Lines) / 1000;

    let ascentM = 0, descentM = 0, baseElevation = null;
    let minElevation = Infinity, maxElevation = -Infinity, elevationSamples = 0;
    for (const line of lines) {
        for (const [, , ele] of line) {
            if (ele == null) continue;
            elevationSamples++;
            minElevation = Math.min(minElevation, ele);
            maxElevation = Math.max(maxElevation, ele);
            if (baseElevation == null) {
                baseElevation = ele;
            } else {
                const diff = ele - baseElevation;
                if (Math.abs(diff) >= ELEVATION_NOISE_THRESHOLD_M) {
                    if (diff > 0) ascentM += diff; else descentM += -diff;
                    baseElevation = ele;
                }
            }
        }
    }
    const hasElevation = elevationSamples > 0;
    const round1 = n => Math.round(n * 10) / 10;

    const waypoints = asArray(gpx.wpt).map(w => ({
        name: w.name ?? null,
        lat: parseFloat(w.lat),
        lon: parseFloat(w.lon),
        elevation: w.ele != null ? parseFloat(w.ele) : null,
    }));

    return {
        stage: {
            stageId: '1',
            stageNumber: 1,
            title: '',
            geometry: { type: 'MultiLineString', coordinates: lv95Lines },
            geometryWgs84: { type: 'MultiLineString', coordinates: lines.map(line => line.map(([lon, lat]) => [lon, lat])) },
        },
        distanceKm,
        distanceMiles: distanceKm * 0.621371,
        ascentM: hasElevation ? round1(ascentM) : undefined,
        descentM: hasElevation ? round1(descentM) : undefined,
        minElevation: hasElevation ? round1(minElevation) : undefined,
        maxElevation: hasElevation ? round1(maxElevation) : undefined,
        startPoint: waypoints[0] ?? undefined,
        endPoint: waypoints.length > 1 ? waypoints[waypoints.length - 1] : undefined,
        pointCount: lines.reduce((sum, l) => sum + l.length, 0),
        segmentCount: lines.length,
    };
}

function slugify(name) {
    return String(name)
        .toLowerCase()
        .normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
}

// A random suffix makes a collision astronomically unlikely, which is simpler than a
// DB-checking retry loop (compare Trip's generateUniqueSlug) for what's a low-frequency,
// single-admin write path.
export function generateRouteNumber(name) {
    const suffix = Math.random().toString(16).slice(2, 8);
    return `custom-${slugify(name) || 'hike'}-${suffix}`;
}

function hikeToTrailRoute(hike) {
    return {
        routeNumber: hike.routeNumber,
        name: hike.name,
        category: hike.category,
        isMultiDay: hike.isMultiDay,
        distanceKm: hike.distanceKm,
        distanceMiles: hike.distanceMiles,
        source: hike.source,
        stages: hike.stages,
    };
}

function minDistanceToPointMeters(lines, easting, northing) {
    let min = Infinity;
    for (const line of lines) {
        for (const [x, y] of line) {
            const d = Math.hypot(x - easting, y - northing);
            if (d < min) min = d;
        }
    }
    return min;
}

// Vertex-nearest-distance, not true point-to-segment distance - deliberate simplification. A
// digitized hike track has hundreds of closely-spaced vertices (556 in the first real example),
// so the error this introduces is negligible next to a many-km search radius. Revisit if the
// collection grows large enough that an in-memory scan (rather than a geospatial index) stops
// being fast enough - not expected any time soon for a manually-curated, admin-added list.
export async function fetchCustomHikesNear({ easting, northing, radiusMeters }) {
    const hikes = await Hike.find();
    return hikes
        .filter(hike => {
            const lines = hike.stages.flatMap(s => s.geometry.coordinates);
            return minDistanceToPointMeters(lines, easting, northing) <= radiusMeters;
        })
        .map(hikeToTrailRoute);
}

export async function searchCustomHikes(query) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hikes = await Hike.find({ name: new RegExp(escaped, 'i') });
    return hikes.map(hikeToTrailRoute);
}
```

---

## 3. Merging custom hikes into the public hikes endpoints

`@backend/src/controllers/hikingRoutes.js` - `getHikes` and `getHikesSearch` each gain a second, parallel data source:

```javascript
import ErrorResponse from '../utils/errorResponse.js';
import asyncHandler from '../middleware/async.js';
import { fetchSchweizMobilRoutes, searchSchweizMobilRoutes, buildGpx, fetchElevationProfile, fetchRouteStages } from '../utils/schweizMobilRoutes.js';
import { fetchCustomHikesNear, searchCustomHikes } from '../utils/customHikes.js';

// ch.astra.wanderland = official SchweizMobil hiking routes (Wanderland)
const HIKING_LAYER = 'ch.astra.wanderland';

// @desc    GET hiking routes near a point
// @route   GET /api/v1/hikes
// @access  Public
export const getHikes = asyncHandler(async (req, res, next) => {
    const { easting, northing } = req.lv95;
    const radiusMeters = parseInt(req.query.radius, 10) || 30000;

    try {
        const [hikes, customHikes] = await Promise.all([
            fetchSchweizMobilRoutes({ layer: HIKING_LAYER, easting, northing, radiusMeters, lang: req.query.lang }),
            fetchCustomHikesNear({ easting, northing, radiusMeters }),
        ]);
        const data = [...hikes, ...customHikes];

        res.status(200).json({ success: true, count: data.length, radiusMeters, data });
    } catch (error) {
        console.error(error);
        next(
            new ErrorResponse(`An error occurred during the request: ${error.message}`, 500)
        );
    }
});

// @desc    Search hiking routes by name
// @route   GET /api/v1/hikes/search?q=&lang=
// @access  Public
export const getHikesSearch = asyncHandler(async (req, res, next) => {
    const query = (req.query.q || '').trim();
    if (!query) return next(new ErrorResponse('q query param is required', 400));

    try {
        const [hikes, customHikes] = await Promise.all([
            searchSchweizMobilRoutes({ layer: HIKING_LAYER, query, lang: req.query.lang }),
            searchCustomHikes(query),
        ]);
        const data = [...hikes, ...customHikes];

        res.status(200).json({ success: true, count: data.length, query, data });
    } catch (error) {
        console.error(error);
        next(
            new ErrorResponse(`An error occurred during the request: ${error.message}`, 500)
        );
    }
});
```

(`getHikesGpx`, `getHikesElevation`, `getHikeStages` are unchanged - the first two already operate on generic `stages` geometry sent from the frontend regardless of origin, and the third is ASTRA-only by design since custom hikes are never multi-day.)

`@frontend/src/app/models/trail-route.ts` - add the new field so it's typed (not yet displayed anywhere - seeaOut of Scope):

```typescript
export interface TrailRoute {
  routeNumber: string | number;
  name: string;
  category: TrailCategory;
  distanceKm: number;
  distanceMiles: number;
  isMultiDay: boolean;
  totalStages?: number;
  source: string;
  stages: TrailStage[];
}
```

---

## 4. Single-admin gating

Reuses the existing hardcoded-account pattern from `controllers/trips.js` (`isCuratedAccount`) rather than introducing a role system for what is, and will remain, exactly one person. Confirmed: the admin account **is** the same account already stored in `CURATED_TRIPS_USER_ID`.

`@backend/src/utils/adminAccount.js` (new) - the shared check, extracted so both curated-trip behavior and the new admin routes stay in sync automatically:

```javascript
// Single hardcoded admin account - not a role system, since there is exactly one admin. Same
// account already used to gate curated-trip translation/language behavior.
export const isAdminAccount = userId => !!userId && userId === process.env.CURATED_TRIPS_USER_ID;
```

`@backend/src/controllers/trips.js` - replace the local helper with the shared one (behavior unchanged):

```javascript
import { isAdminAccount } from '../utils/adminAccount.js';

const isSlugTaken = slug => Trip.exists({ slug }).then(Boolean);
```

and rename its two call sites (`createTrip`, `updateTrip`) from `isCuratedAccount(...)` to `isAdminAccount(...)`.

`@backend/src/middleware/requireAdmin.js` (new) - must run after `protect`, which populates `req.user`:

```javascript
import ErrorResponse from '../utils/errorResponse.js';
import { isAdminAccount } from '../utils/adminAccount.js';

export const requireAdmin = (req, res, next) => {
    if (!isAdminAccount(req.user?.id)) {
        return next(new ErrorResponse('Not authorised to access this route', 403));
    }
    next();
};
```

`@backend/src/controllers/auth.js` - `getMe` exposes `isAdmin` so the frontend can gate the `/admin` route without a dedicated endpoint:

```javascript
import { isAdminAccount } from '../utils/adminAccount.js';

export const getMe = AsyncHandler(async (req, res, next) => {
    const user = await User.findById(req.user.id).select('+isPro +stripeCustomerId');

    const data = user.toObject();
    data.hasStripeCustomer = !!data.stripeCustomerId;
    delete data.stripeCustomerId;
    data.isAdmin = isAdminAccount(user.id);

    res.status(200).json({
        success: true,
        data,
    });
});
```

`@frontend/src/app/core/services/auth.ts`:

- `CurrentUser` gains the field:

```typescript
export interface CurrentUser {
  _id: string;
  firstName: string;
  lastName: string;
  country: string;
  email: string;
  emailUpdates: boolean;
  isPro?: boolean;
  isAdmin?: boolean;
  hasStripeCustomer?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
```

- Cache the resolved user on a signal so the admin shell (§7) doesn't need a second `getMe()` round-trip after the guard (§6) already made one:

```typescript
readonly currentUser = signal<CurrentUser | null>(null);
```

- `getMe()` populates it:

```typescript
async getMe(): Promise<CurrentUser> {
  const res = await firstValueFrom(
    this.http.get<{ data: CurrentUser }>(`${environment.apiUrl}/api/v1/auth/me`)
  );
  this.currentUser.set(res.data);
  return res.data;
}
```

---

## 5. Admin hikes API

`@backend/src/controllers/adminHikes.js` (new):

```javascript
import asyncHandler from '../middleware/async.js';
import ErrorResponse from '../utils/errorResponse.js';
import Hike from '../models/Hike.js';
import Trip from '../models/Trip.js';
import { parseGpx, generateRouteNumber } from '../utils/customHikes.js';

// @desc    List all custom hikes
// @route   GET /api/v1/admin/hikes
// @access  Private/Admin
export const getAdminHikes = asyncHandler(async (req, res) => {
    const hikes = await Hike.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: hikes.length, data: hikes });
});

// @desc    Parse a GPX file and return its computed stats, without saving anything
// @route   POST /api/v1/admin/hikes/preview
// @access  Private/Admin
export const previewHike = asyncHandler(async (req, res, next) => {
    const { gpx } = req.body;
    if (!gpx) return next(new ErrorResponse('gpx is required', 400));

    let parsed;
    try {
        parsed = parseGpx(gpx);
    } catch (err) {
        return next(new ErrorResponse(err.message, 400));
    }

    res.status(200).json({ success: true, data: parsed });
});

// @desc    Add a new custom hike
// @route   POST /api/v1/admin/hikes
// @access  Private/Admin
export const createAdminHike = asyncHandler(async (req, res, next) => {
    const { name, gpx } = req.body;
    if (!name || !gpx) return next(new ErrorResponse('name and gpx are required', 400));

    let parsed;
    try {
        parsed = parseGpx(gpx);
    } catch (err) {
        return next(new ErrorResponse(err.message, 400));
    }

    const hike = await Hike.create({
        routeNumber: generateRouteNumber(name),
        name,
        distanceKm: parsed.distanceKm,
        distanceMiles: parsed.distanceMiles,
        stages: [parsed.stage],
        ascentM: parsed.ascentM,
        descentM: parsed.descentM,
        minElevation: parsed.minElevation,
        maxElevation: parsed.maxElevation,
        startPoint: parsed.startPoint,
        endPoint: parsed.endPoint,
    });

    res.status(201).json({ success: true, data: hike });
});

// @desc    Rename a custom hike (metadata-only - no GPX replacement in this pass, see spec)
// @route   PATCH /api/v1/admin/hikes/:id
// @access  Private/Admin
export const updateAdminHike = asyncHandler(async (req, res, next) => {
    const { name } = req.body;
    if (!name) return next(new ErrorResponse('name is required', 400));

    const hike = await Hike.findByIdAndUpdate(req.params.id, { name }, { new: true, runValidators: true });
    if (!hike) return next(new ErrorResponse('Hike not found', 404));

    res.status(200).json({ success: true, data: hike });
});

// @desc    Delete a custom hike, cascading its removal from any saved trips
// @route   DELETE /api/v1/admin/hikes/:id
// @access  Private/Admin
export const deleteAdminHike = asyncHandler(async (req, res, next) => {
    const hike = await Hike.findById(req.params.id);
    if (!hike) return next(new ErrorResponse('Hike not found', 404));

    // Trip.distanceKm is the road/rail route distance (routeDistanceKm), not a sum of activity
    // distances - so pulling the activity here needs no distanceKm recompute on the trip.
    await Trip.updateMany(
        { activities: { $elemMatch: { kind: 'hike', refId: hike.routeNumber } } },
        { $pull: { activities: { kind: 'hike', refId: hike.routeNumber } } }
    );
    await hike.deleteOne();

    res.status(200).json({ success: true, data: {} });
});
```

`@backend/src/routes/adminHikes.js` (new):

```javascript
import express from 'express';
import { protect } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { getAdminHikes, previewHike, createAdminHike, updateAdminHike, deleteAdminHike } from '../controllers/adminHikes.js';

const router = express.Router();

router.use(protect, requireAdmin);

router.get('/', getAdminHikes);
router.post('/preview', previewHike);
router.post('/', createAdminHike);
router.patch('/:id', updateAdminHike);
router.delete('/:id', deleteAdminHike);

export default router;
```

`@backend/src/server.js` - import and mount alongside the existing routes:

```javascript
import hotels from './routes/hotels.js';
import adminHikes from './routes/adminHikes.js';
```

```javascript
app.use('/api/v1/hotels', hotels);
app.use('/api/v1/admin/hikes', adminHikes);
```

---

## 6. Frontend: `/admin` route, guard, desktop-notice bypass

The admin section lives outside the `:lang`-prefixed, `MainLayout`-wrapped route tree entirely - it's an internal tool, not a localized public page - as a sibling top-level route.

`@frontend/src/app/core/guards/admin.ts` (new):

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';

export const adminGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);

  if (!auth.isLoggedIn()) return router.parseUrl('/');

  try {
    const me = await auth.getMe();
    return me.isAdmin ? true : router.parseUrl('/');
  } catch {
    return router.parseUrl('/');
  }
};
```

`@frontend/src/app/app.routes.ts` - new top-level route, placed before the `bareLangMatcher` catch-all so `/admin` doesn't get swept into the "unprefixed → redirect to /en" rule (`:lang`'s `canMatch` guard already rejects `admin` as an unrecognized locale, so route order between `:lang` and this one doesn't matter - order relative to `bareLangMatcher` does):

```typescript
import { adminGuard } from './core/guards/admin';
```

```typescript
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/admin-shell/admin-shell').then(m => m.AdminShell),
    children: [
      { path: '', redirectTo: 'hikes', pathMatch: 'full' },
      {
        path: 'hikes',
        loadComponent: () => import('./features/admin/admin-hikes/admin-hikes').then(m => m.AdminHikes),
      },
    ],
  },
  // Anything whose first segment isn't a recognized locale ...
  {
    matcher: bareLangMatcher,
    ...
```

The desktop "use mobile" notice (`context/features/desktop-mobile-notice-spec.md`) renders above the entire `<router-outlet>` in `app.html`, so it would otherwise hide `/admin` at desktop width like every other page. Bypass it by path, the same way the existing `?preview=desktop` dev bypass works, so the owner never has to think about it:

`@frontend/src/index.html`:

```javascript
        var bypass = localStorage.getItem('as-desktop-preview') === '1'
          || window.location.pathname.indexOf('/admin') === 0;
```

`@frontend/src/app/shared/services/breakpoint.ts` - constructor:

```typescript
    if (new URLSearchParams(window.location.search).get('preview') === 'desktop') {
      localStorage.setItem(DESKTOP_PREVIEW_STORAGE_KEY, '1');
    }
    const previewBypass = localStorage.getItem(DESKTOP_PREVIEW_STORAGE_KEY) === '1';
    const isAdminRoute = window.location.pathname.startsWith('/admin');
    const bypassNotice = previewBypass || isAdminRoute;

    const noticeMql = window.matchMedia(`(min-width: ${DESKTOP_NOTICE_MIN_WIDTH}px)`);
    this.isDesktopNotice.set(!bypassNotice && noticeMql.matches);
    noticeMql.addEventListener('change', e => this.isDesktopNotice.set(!bypassNotice && e.matches));
```

(The unconditional `document.documentElement.classList.remove(DESKTOP_GATE_CLASS);` at the end of the constructor already runs regardless of branch - no change needed there.)

---

## 7. Frontend: admin shell (sidebar layout)

Matches the approved mockup (navy sidebar, nav items, account footer) using the app's real design tokens and Font Awesome icon set (already loaded globally via `index.html`'s kit script - the mockup's hand-drawn inline SVGs were only a design-canvas sandboxing workaround, not a real-app constraint). Only the "Hikes" nav item is wired up; the sidebar's structure - one `<a routerLink>` per section - is the extension point for the future Users/Chat Messages sections (see Out of Scope).

`@frontend/src/app/features/admin/admin-shell/admin-shell.ts` (new):

```typescript
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../../../core/services/auth';

@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.css',
})
export class AdminShell {
  protected readonly auth = inject(Auth);
}
```

`@frontend/src/app/features/admin/admin-shell/admin-shell.html` (new):

```html
<div class="admin-shell">
  <aside class="admin-sidebar">
    <div class="admin-brand">
      <div class="admin-brand-name">ActivSwitzerland</div>
      <div class="admin-brand-tag">Admin</div>
    </div>
    <nav class="admin-nav">
      <a class="admin-nav-item" routerLink="hikes" routerLinkActive="active">
        <i class="fa-solid fa-route"></i>
        <span>Hikes</span>
      </a>
    </nav>
    @if (auth.currentUser(); as user) {
      <div class="admin-account">
        <div class="admin-avatar">{{ user.firstName[0] }}</div>
        <div>
          <div class="admin-account-name">{{ user.firstName }} {{ user.lastName }}</div>
          <div class="admin-account-role">Administrator</div>
        </div>
      </div>
    }
  </aside>
  <main class="admin-content">
    <router-outlet />
  </main>
</div>
```

`@frontend/src/app/features/admin/admin-shell/admin-shell.css` (new):

```css
:host {
  display: block;
  height: 100vh;
}
.admin-shell {
  display: flex;
  height: 100%;
}
.admin-sidebar {
  width: 240px;
  min-width: 240px;
  background: var(--navy-900);
  color: #fff;
  display: flex;
  flex-direction: column;
}
.admin-brand {
  padding: 1.5rem 1.25rem 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.admin-brand-name { font-size: 1rem; font-weight: 800; }
.admin-brand-tag {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 0.3rem;
}
.admin-nav {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 1rem 0.75rem;
  flex: 1;
}
.admin-nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.9rem;
  font-weight: 500;
  text-decoration: none;
}
.admin-nav-item.active {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-weight: 600;
}
.admin-account {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.admin-avatar {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  background: var(--navy-700);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 700;
  flex-shrink: 0;
}
.admin-account-name { font-size: 0.85rem; font-weight: 600; }
.admin-account-role { font-size: 0.7rem; color: rgba(255, 255, 255, 0.5); }
.admin-content {
  flex: 1;
  overflow-y: auto;
  background: var(--gray-50);
}
```

---

## 8. Frontend: Hikes admin page

List + add/edit drawer. The add flow's map preview reuses the real `MapComponent` (`shared/map/map.ts`, `trailRoute`/`fitBounds`/`trailColor`/`distanceLabel` inputs - the same ones `hike-detail` uses) instead of a static image, so the admin sees the actual parsed track, not an approximation. Delete uses the app's existing `ConfirmationService`/`p-confirmDialog` pattern (already used in `profile.ts` for trip deletion) rather than a native `confirm()`.

`@frontend/src/app/features/admin/services/admin-hikes.ts` (new):

```typescript
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface AdminHikeStage {
  stageId: string;
  stageNumber: number;
  title: string;
  geometry: { type: 'MultiLineString'; coordinates: [number, number][][] };
  geometryWgs84: { type: 'MultiLineString'; coordinates: [number, number][][] };
}

export interface AdminHike {
  _id: string;
  routeNumber: string;
  name: string;
  category: string;
  isMultiDay: boolean;
  distanceKm: number;
  distanceMiles: number;
  ascentM?: number;
  descentM?: number;
  minElevation?: number;
  maxElevation?: number;
  source: string;
  stages: AdminHikeStage[];
}

export interface HikePreview {
  distanceKm: number;
  distanceMiles: number;
  ascentM?: number;
  descentM?: number;
  minElevation?: number;
  maxElevation?: number;
  pointCount: number;
  segmentCount: number;
  stage: AdminHikeStage;
}

@Injectable({ providedIn: 'root' })
export class AdminHikesService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/v1/admin/hikes`;

  async list(): Promise<AdminHike[]> {
    const res = await firstValueFrom(this.http.get<{ data: AdminHike[] }>(this.base));
    return res.data;
  }

  async preview(gpx: string): Promise<HikePreview> {
    const res = await firstValueFrom(this.http.post<{ data: HikePreview }>(`${this.base}/preview`, { gpx }));
    return res.data;
  }

  async create(name: string, gpx: string): Promise<AdminHike> {
    const res = await firstValueFrom(this.http.post<{ data: AdminHike }>(this.base, { name, gpx }));
    return res.data;
  }

  async update(id: string, name: string): Promise<AdminHike> {
    const res = await firstValueFrom(this.http.patch<{ data: AdminHike }>(`${this.base}/${id}`, { name }));
    return res.data;
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/${id}`));
  }
}
```

`@frontend/src/app/features/admin/admin-hikes/admin-hikes.ts` (new):

```typescript
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { MapComponent } from '../../../shared/map/map';
import { Toast } from '../../../core/services/toast';
import { AdminHikesService, AdminHike, HikePreview } from '../services/admin-hikes';

@Component({
  selector: 'app-admin-hikes',
  imports: [FormsModule, DecimalPipe, ConfirmDialog, MapComponent],
  providers: [ConfirmationService], // not provided at root - same as profile.ts
  templateUrl: './admin-hikes.html',
  styleUrl: './admin-hikes.css',
})
export class AdminHikes {
  private svc = inject(AdminHikesService);
  private toast = inject(Toast);
  private confirmSvc = inject(ConfirmationService);

  protected readonly hikes = signal<AdminHike[]>([]);
  protected readonly loading = signal(true);

  protected readonly drawerOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  // A signal, not a plain field bound via [(ngModel)] - canSave below is a computed() and only
  // re-evaluates when a signal it read actually changes; a plain mutable field is invisible to
  // that dependency tracking, so the Save button would get stuck on whatever canSave's first
  // memoized result was (found live: typing the name after picking the GPX file left it disabled).
  protected readonly nameModel = signal('');
  protected readonly gpxContent = signal<string | null>(null);
  protected readonly gpxFilename = signal<string | null>(null);
  protected readonly preview = signal<HikePreview | null>(null);
  protected readonly previewLoading = signal(false);
  protected readonly saving = signal(false);

  protected readonly previewLines = computed(() => this.preview()?.stage.geometryWgs84.coordinates ?? null);
  protected readonly previewBoundsPoints = computed(() => this.previewLines()?.flat() ?? null);
  // Computed here rather than `(p.distanceKm | number) + ' km'` in the template - strictTemplates
  // (on in this project) types a pipe's return as nullable when used inside a larger expression,
  // so string-concatenating a piped value is a type error even though the pipe never returns null
  // here.
  protected readonly previewDistanceLabel = computed(() => {
    const p = this.preview();
    return p ? `${p.distanceKm.toFixed(2)} km` : null;
  });
  protected readonly canSave = computed(() => !!this.nameModel().trim() && (!!this.editingId() || !!this.preview()));

  constructor() {
    this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.hikes.set(await this.svc.list());
    } finally {
      this.loading.set(false);
    }
  }

  openAdd(): void {
    this.editingId.set(null);
    this.nameModel.set('');
    this.gpxContent.set(null);
    this.gpxFilename.set(null);
    this.preview.set(null);
    this.drawerOpen.set(true);
  }

  openEdit(hike: AdminHike): void {
    this.editingId.set(hike._id);
    this.nameModel.set(hike.name);
    this.gpxContent.set(null);
    this.gpxFilename.set(null);
    this.preview.set(null);
    this.drawerOpen.set(true);
  }

  close(): void {
    this.drawerOpen.set(false);
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const text = await file.text();
    this.gpxFilename.set(file.name);
    this.gpxContent.set(null);
    this.preview.set(null);
    this.previewLoading.set(true);
    try {
      const result = await this.svc.preview(text);
      this.gpxContent.set(text);
      this.preview.set(result);
    } catch (err: any) {
      this.gpxFilename.set(null);
      this.toast.error('Could not read GPX file', err?.error?.err ?? 'Check the file and try again', 4000, 'toast-error');
    } finally {
      this.previewLoading.set(false);
    }
  }

  async save(): Promise<void> {
    if (!this.canSave() || this.saving()) return;
    this.saving.set(true);
    try {
      if (this.editingId()) {
        await this.svc.update(this.editingId()!, this.nameModel().trim());
      } else {
        await this.svc.create(this.nameModel().trim(), this.gpxContent()!);
      }
      this.drawerOpen.set(false);
      await this.load();
    } catch (err: any) {
      this.toast.error('Save failed', err?.error?.err ?? 'Something went wrong', 4000, 'toast-error');
    } finally {
      this.saving.set(false);
    }
  }

  confirmRemove(hike: AdminHike): void {
    this.confirmSvc.confirm({
      message: `Delete "${hike.name}"? This also removes it from any saved trips.`,
      header: 'Delete Hike',
      icon: 'fa-light fa-triangle-exclamation',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        await this.svc.remove(hike._id);
        await this.load();
      },
    });
  }
}
```

`@frontend/src/app/features/admin/admin-hikes/admin-hikes.html` (new):

```html
<div class="ah-header">
  <div>
    <h1>Hikes</h1>
    <p>Custom hikes shown alongside SchweizMobil routes</p>
  </div>
  <button type="button" class="ah-btn-primary" (click)="openAdd()">
    <i class="fa-solid fa-plus"></i>
    <span>Add Hike</span>
  </button>
</div>

<div class="ah-body">
  @if (loading()) {
    <p class="ah-muted">Loading…</p>
  } @else {
    <p class="ah-muted">{{ hikes().length }} hikes</p>
    <div class="ah-list">
      @for (hike of hikes(); track hike._id) {
        <div class="ah-card">
          <div class="ah-card-main">
            <div class="ah-card-title-row">
              <span class="ah-card-title">{{ hike.name }}</span>
              <span class="ah-pill ah-pill-category">{{ hike.category }}</span>
              <span class="ah-pill ah-pill-source">{{ hike.source }}</span>
            </div>
            <div class="ah-card-meta">
              {{ hike.distanceKm | number: '1.1-1' }} km
              @if (hike.ascentM != null) {
                &middot; Ascent {{ hike.ascentM | number: '1.0-0' }} m
              }
              @if (hike.descentM != null) {
                &middot; Descent {{ hike.descentM | number: '1.0-0' }} m
              }
            </div>
          </div>
          <div class="ah-card-actions">
            <button type="button" class="ah-icon-btn" (click)="openEdit(hike)" aria-label="Edit">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button type="button" class="ah-icon-btn ah-icon-btn-danger" (click)="confirmRemove(hike)" aria-label="Delete">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      } @empty {
        <p class="ah-muted">No custom hikes yet.</p>
      }
    </div>
  }
</div>

@if (drawerOpen()) {
  <div class="ah-scrim" (click)="close()"></div>
  <div class="ah-drawer">
    <div class="ah-drawer-header">
      <span>{{ editingId() ? 'Edit Hike' : 'Add Hike' }}</span>
      <button type="button" class="ah-icon-btn" (click)="close()" aria-label="Close">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="ah-drawer-body">
      <label class="ah-field">
        <span class="ah-label">Name</span>
        <input type="text" [ngModel]="nameModel()" (ngModelChange)="nameModel.set($event)" />
      </label>

      @if (!editingId()) {
        <label class="ah-field">
          <span class="ah-label">GPX File</span>
          @if (!gpxFilename()) {
            <div class="ah-dropzone" (click)="fileInput.click()">
              <i class="fa-solid fa-file-arrow-up"></i>
              <span>Click to choose a GPX file</span>
            </div>
          } @else {
            <div class="ah-file-chip">
              <i class="fa-solid fa-file"></i>
              <div class="ah-file-chip-text">
                <div>{{ gpxFilename() }}</div>
                @if (preview(); as p) {
                  <div class="ah-muted-sm">{{ p.pointCount }} points &middot; {{ p.segmentCount }} segments</div>
                }
              </div>
              @if (previewLoading()) {
                <i class="fa-solid fa-spinner fa-spin"></i>
              } @else if (preview()) {
                <i class="fa-solid fa-check ah-ok"></i>
              }
            </div>
            <button type="button" class="ah-link" (click)="fileInput.click()">Replace file</button>
          }
          <input #fileInput type="file" accept=".gpx" hidden (change)="onFileSelected($event)" />
        </label>

        @if (preview(); as p) {
          <div class="ah-preview-label">Preview</div>
          <div class="ah-map-preview">
            <app-map
              [trailRoute]="previewLines()"
              [fitBounds]="previewBoundsPoints()"
              trailColor="#d97706"
              [distanceLabel]="previewDistanceLabel()"
            />
          </div>
          <div class="ah-stats-grid">
            <div class="ah-stat">
              <div class="ah-stat-label">Distance</div>
              <div class="ah-stat-value">{{ p.distanceKm | number: '1.2-2' }} km</div>
            </div>
            <div class="ah-stat">
              <div class="ah-stat-label">Ascent</div>
              <div class="ah-stat-value">
                @if (p.ascentM != null) {
                  {{ p.ascentM | number: '1.0-0' }} m
                } @else {
                  —
                }
              </div>
            </div>
            <div class="ah-stat">
              <div class="ah-stat-label">Descent</div>
              <div class="ah-stat-value">
                @if (p.descentM != null) {
                  {{ p.descentM | number: '1.0-0' }} m
                } @else {
                  —
                }
              </div>
            </div>
            <div class="ah-stat">
              <div class="ah-stat-label">Elevation</div>
              <div class="ah-stat-value">
                @if (p.minElevation != null) {
                  {{ p.minElevation | number: '1.0-0' }}–{{ p.maxElevation | number: '1.0-0' }} m
                } @else {
                  —
                }
              </div>
            </div>
          </div>
        }
      }
    </div>
    <div class="ah-drawer-footer">
      <button type="button" class="ah-btn-secondary" (click)="close()">Cancel</button>
      <button type="button" class="ah-btn-primary" [disabled]="!canSave() || saving()" (click)="save()">
        {{ saving() ? 'Saving…' : 'Save Hike' }}
      </button>
    </div>
  </div>
}

<p-confirmDialog />
```

`@frontend/src/app/features/admin/admin-hikes/admin-hikes.css` (new) - same tokens as the mockup, now real:

```css
:host {
  display: block;
  padding: 1.75rem 2rem 2rem;
}
.ah-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.ah-header h1 { font-size: 1.75rem; font-weight: 800; color: var(--navy-900); line-height: 1.15; margin: 0; }
.ah-header p { font-size: 0.85rem; color: var(--gray-500); margin: 0.3rem 0 0; }
.ah-btn-primary, .ah-btn-secondary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: none;
  border-radius: 10px;
  padding: 0.65rem 1.1rem;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}
.ah-btn-primary { background: var(--navy-900); color: #fff; }
.ah-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.ah-btn-secondary { background: var(--gray-200); color: var(--navy-900); }
.ah-muted { font-size: 0.8rem; color: var(--gray-500); margin: 0 0 0.75rem; }
.ah-muted-sm { font-size: 0.72rem; color: var(--gray-500); margin-top: 0.1rem; }
.ah-list { display: flex; flex-direction: column; gap: 0.75rem; }
.ah-card {
  background: #fff;
  border: 1px solid var(--gray-200);
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.07);
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.ah-card-title-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.ah-card-title { font-size: 1rem; font-weight: 700; color: var(--gray-900, #1f2937); }
.ah-card-meta { font-size: 0.8rem; color: var(--gray-500); margin-top: 0.4rem; }
.ah-pill {
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  padding: 0.15rem 0.5rem;
}
.ah-pill-category { background: rgba(217, 119, 6, 0.12); color: var(--amber-700); text-transform: uppercase; }
.ah-pill-source { background: var(--gray-100); color: var(--gray-700); }
.ah-card-actions { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.ah-icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--gray-200);
  background: #fff;
  color: var(--gray-700);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.ah-icon-btn-danger { color: var(--color-error); }
.ah-scrim { position: fixed; inset: 0; background: rgba(12, 35, 64, 0.35); z-index: 300; }
.ah-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 480px;
  max-width: 100vw;
  background: #fff;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  z-index: 301;
}
.ah-drawer-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--gray-200);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--navy-900);
}
.ah-drawer-body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
  flex: 1;
  overflow-y: auto;
}
.ah-field { display: flex; flex-direction: column; gap: 0.35rem; }
.ah-label { font-size: 0.8rem; font-weight: 600; color: var(--navy-700); }
.ah-field input[type='text'] {
  border: 1.5px solid var(--gray-200);
  border-radius: 8px;
  padding: 0.6rem 0.75rem;
  font-size: 0.9rem;
  color: var(--gray-900, #1f2937);
}
.ah-dropzone {
  border: 1.5px dashed var(--gray-200);
  border-radius: 10px;
  padding: 1.5rem;
  text-align: center;
  color: var(--gray-500);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}
.ah-file-chip {
  border: 1.5px dashed var(--gray-200);
  border-radius: 10px;
  padding: 0.9rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #f8fafc;
}
.ah-file-chip-text { flex: 1; font-size: 0.85rem; font-weight: 600; color: var(--gray-900, #1f2937); }
.ah-ok { color: var(--color-green); }
.ah-link { font-size: 0.75rem; font-weight: 600; color: var(--navy-700); background: none; border: none; cursor: pointer; text-align: left; padding: 0; }
.ah-preview-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--gray-500); margin-top: 0.25rem; }
.ah-map-preview { height: 200px; border-radius: 10px; overflow: hidden; position: relative; }
.ah-stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.6rem; }
.ah-stat { background: var(--gray-50); border-radius: 8px; padding: 0.6rem 0.5rem; text-align: center; }
.ah-stat-label { font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--gray-500); }
.ah-stat-value { font-size: 0.95rem; font-weight: 800; color: var(--navy-900); margin-top: 0.2rem; }
.ah-drawer-footer {
  border-top: 1px solid var(--gray-200);
  padding: 0.75rem 1.5rem;
  background: #fff;
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}
```

---

## Out of Scope

- **Users / Chat Messages admin sections** - mocked (as a "Planned" stub screen) to confirm the shell shape, not built. The sidebar's one-`<a>`-per-section structure is the extension point for these; each is its own future spec.
- **Multi-day custom hikes** - every custom hike is single-stage by design decision (all GPX files provided so far are one hike, one route). Revisit `isMultiDay`/multi-stage ingestion if that changes.
- **GPX replacement on edit** - edit is metadata-only (rename). Fixing a bad track means delete + re-add, not a replace-in-place flow.
- **Public-facing attribution/credit UI** for the new `source` field - a separate, already-known compliance gap (geo.admin.ch requires an "ASTRA + Kanton" citation for `ch.astra.wanderland` data, not yet shown anywhere in the app) that this spec doesn't attempt to close; `source` is stored and returned by the API but not yet rendered anywhere in the public app.
- **Geospatial indexing** for the `hikes` collection - an in-memory distance scan is used instead (see `fetchCustomHikesNear`'s comment); fine at the expected scale of a manually-curated, admin-added list.
- **Multipart/file upload (`multer`)** - the GPX travels as a JSON string field instead, since the frontend already has the file's text content client-side and the global `express.json({ limit: '10mb' })` comfortably covers a GPX file's size. Avoids a new dependency for no real benefit here.
- **i18n for the admin UI** - English-only, hardcoded strings throughout (no `TranslatePipe`/i18n keys) - this is an internal tool for one person, not public-facing.
- **Retry-on-collision for `routeNumber`** - a random suffix makes a collision practically impossible; no DB-checking retry loop like `Trip`'s `generateUniqueSlug`.

---

## References

- @backend/src/models/Hike.js
- @backend/src/utils/customHikes.js
- @backend/src/utils/schweizMobilRoutes.js
- @backend/src/utils/adminAccount.js
- @backend/src/middleware/requireAdmin.js
- @backend/src/middleware/auth.js
- @backend/src/controllers/adminHikes.js
- @backend/src/controllers/hikingRoutes.js
- @backend/src/controllers/trips.js
- @backend/src/controllers/auth.js
- @backend/src/routes/adminHikes.js
- @backend/src/server.js
- @backend/src/models/Trip.js
- @frontend/src/app/models/trail-route.ts
- @frontend/src/app/core/services/auth.ts
- @frontend/src/app/core/guards/admin.ts
- @frontend/src/app/core/guards/auth.ts
- @frontend/src/app/app.routes.ts
- @frontend/src/index.html
- @frontend/src/app/shared/services/breakpoint.ts
- @frontend/src/app/features/admin/admin-shell/admin-shell.ts
- @frontend/src/app/features/admin/services/admin-hikes.ts
- @frontend/src/app/features/admin/admin-hikes/admin-hikes.ts
- @frontend/src/app/shared/map/map.ts
- @frontend/src/app/features/auth/profile/profile.ts
- @context/data/data.gpx
