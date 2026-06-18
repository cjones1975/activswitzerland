# Transport Connection Detail — Spec

**Branch:** `feature/transport-connection-detail`
**Scope:** `frontend/src/app/features/trip-planner` — `connection` step only (rail trip type)

---

## Goal

Redesign the connection cards in the trip planner's **connection** step to match the provided mock-up:

1. Each card shows a new collapsed layout: route header, transfers + duration metadata, and a visual timeline bar.
2. Each card can be expanded via a chevron to reveal full journey detail: per-leg station stops with times and platform badges, train service names and directions, and walk indicators between transfers.
3. Selecting a connection is done by clicking the card body (no separate "Select" button).

---

## 1. Data model — `models/trip.ts`

### New interfaces

```typescript
export interface TripSectionStop {
  time:      string;    // ISO datetime
  station:   string;
  platform?: string;    // track/platform number, e.g. "4"
}

export interface TripSectionJourney {
  name:      string;    // e.g. "IR 36"
  category:  string;    // short code, e.g. "IR", "IC", "S"
  number:    string;    // e.g. "36"
  direction: string;    // destination label, e.g. "Olten"
}

export interface TripSection {
  type:          'journey' | 'walk';
  departure?:    TripSectionStop;
  arrival?:      TripSectionStop;
  journey?:      TripSectionJourney;
  walkDuration?: number;           // minutes — only when type === 'walk'
}
```

### Extend `TripConnection`

Add `sections` as optional (so connections persisted without it still load):

```typescript
export interface TripConnection {
  from:             string;
  to:               string;
  departure:        string;
  arrival:          string;
  duration:         string;
  transfers:        number;
  products:         string[];
  routeCoordinates: [number, number][];
  sections?:        TripSection[];   // ← new
}
```

---

## 2. Transport service — `shared/services/transport.ts`

### Extend internal `ConnectionResult` types

The Swiss Transport API already returns section-level departure/arrival/platform/journey data via the `sections` array on each connection. Extend the existing `ConnectionResult` interface to capture this data:

```typescript
interface SectionStop {
  station:    { name: string };
  departure?: string;      // ISO datetime (on departure stop)
  arrival?:   string;      // ISO datetime (on arrival stop)
  platform?:  string;
}

interface SectionJourney {
  name:      string;       // e.g. "IR 36"
  category:  string;
  number:    string;
  to:        string;       // direction
  passList?: { station: PassListStation }[];
}

interface SectionWalk {
  duration: number;        // minutes
}

interface ConnectionSection {
  departure?: SectionStop;
  arrival?:   SectionStop;
  journey?:   SectionJourney;
  walk?:      SectionWalk;
}
```

Update the existing `ConnectionResult.sections` type from the broad form it currently has to `ConnectionSection[]`.

### New private `mapSections` method

Add to `TransportService`:

```typescript
private mapSections(sections: ConnectionSection[]): TripSection[] {
  return sections
    .filter(s => s.journey || s.walk)
    .map(s => {
      if (s.walk) {
        return { type: 'walk', walkDuration: s.walk.duration };
      }
      return {
        type: 'journey',
        departure: {
          time:     s.departure?.departure ?? '',
          station:  s.departure?.station.name ?? '',
          platform: s.departure?.platform,
        },
        arrival: {
          time:     s.arrival?.arrival ?? '',
          station:  s.arrival?.station.name ?? '',
          platform: s.arrival?.platform,
        },
        journey: {
          name:      s.journey!.name,
          category:  s.journey!.category,
          number:    s.journey!.number,
          direction: s.journey!.to,
        },
      };
    });
}
```

### Update `getConnections` mapping

In the `map(res => ...)` call, add to each connection object:

```typescript
sections: this.mapSections(c.sections ?? []),
```

---

## 3. Component — `trip-planner.ts`

### New signal

```typescript
expandedConnectionIndex = signal<number | null>(null);
```

### New methods

```typescript
toggleDetail(index: number, event: Event): void {
  event.stopPropagation();
  this.expandedConnectionIndex.update(i => (i === index ? null : index));
}

formatPlatform(platform?: string): string {
  return platform ? `Pl. ${platform}` : '';
}

trainColor(category: string): string {
  const longDistance = ['IC', 'ICN', 'IR', 'EC', 'EN', 'TGV', 'RJX'];
  return longDistance.includes(category?.toUpperCase()) ? '#dc2626' : '#0079c3';
}

categoryLabel(category: string): string {
  const labels: Record<string, string> = {
    IC: 'Intercity', ICN: 'Intercity-Neigezug', IR: 'InterRegio',
    EC: 'EuroCity',  RE: 'RegioExpress',         S: 'S-Bahn',
  };
  return labels[category?.toUpperCase()] ?? category;
}
```

### Change selection interaction

`selectConnection(conn)` remains unchanged. The card body click calls it; the chevron click calls `toggleDetail` with `stopPropagation` so it does not also trigger selection.

---

## 4. Template — `trip-planner.html`

Replace the entire `@for (conn of connections(); ...)` block inside `@case ('connection')` with the new design below. Remove `<p-button [label]="'trip.planner.select'">`.

### 4a. Collapsed card

```html
@for (conn of connections(); track conn.departure; let idx = $index) {
  <div
    class="conn-card"
    [class.conn-card--selected]="isSelectedConnection(conn)"
    (click)="selectConnection(conn)">

    <!-- Row 1: route + chevron -->
    <div class="conn-header">
      <span class="conn-route">{{ conn.from }} → {{ conn.to }}</span>
      <button class="conn-expand-btn" (click)="toggleDetail(idx, $event)" type="button">
        <i [class]="expandedConnectionIndex() === idx
            ? 'fa-light fa-chevron-up'
            : 'fa-light fa-chevron-down'"></i>
      </button>
    </div>

    <!-- Row 2: transfers + duration -->
    <div class="conn-meta">
      <span class="conn-meta-item">
        <i class="fa-light fa-arrows-repeat"></i>
        {{ conn.transfers }} {{ (conn.transfers === 1 ? 'trip.planner.transfer' : 'trip.planner.transfers') | translate }}
      </span>
      <span class="conn-meta-item">
        <i class="fa-light fa-clock"></i>
        {{ formatDuration(conn.duration) }}
      </span>
    </div>

    <!-- Row 3: timeline bar -->
    <div class="conn-timeline">
      <span class="conn-timeline-time">{{ formatTime(conn.departure) }}</span>
      <div class="conn-timeline-bar">
        <span class="conn-timeline-dot"></span>
        <span class="conn-timeline-line"></span>
        <span class="conn-timeline-dot"></span>
      </div>
      <span class="conn-timeline-time">{{ formatTime(conn.arrival) }}</span>
    </div>

    <!-- Expandable detail -->
    @if (expandedConnectionIndex() === idx && conn.sections?.length) {
      <div class="conn-detail">
        <!-- see 4b -->
      </div>
    }

  </div>
}
```

### 4b. Expanded section list

Inside `.conn-detail`, iterate over `conn.sections`:

```html
@for (section of conn.sections!; track $index) {

  @if (section.type === 'journey') {

    <!-- Departure stop -->
    <div class="conn-stop">
      <span class="conn-stop-dot"></span>
      <span class="conn-stop-time">{{ formatTime(section.departure!.time) }}</span>
      <span class="conn-stop-station">{{ section.departure!.station }}</span>
      @if (section.departure!.platform) {
        <span class="conn-platform-badge">{{ formatPlatform(section.departure!.platform) }}</span>
      }
    </div>

    <!-- Train leg -->
    <div class="conn-leg">
      <span class="conn-leg-line"></span>
      <div class="conn-leg-body">
        <span class="conn-train" [style.color]="trainColor(section.journey!.category)">
          <i class="fa-regular fa-train-subway"></i>
          {{ section.journey!.name }}
          <span class="conn-train-type">({{ categoryLabel(section.journey!.category) }})</span>
        </span>
        <span class="conn-leg-direction">
          {{ 'trip.planner.connection.direction' | translate }}: {{ section.journey!.direction }}
        </span>
      </div>
    </div>

    <!-- Arrival stop (always shown — platform may differ from next section's departure) -->
    <div class="conn-stop">
      <span class="conn-stop-dot"></span>
      <span class="conn-stop-time">{{ formatTime(section.arrival!.time) }}</span>
      <span class="conn-stop-station">{{ section.arrival!.station }}</span>
      @if (section.arrival!.platform) {
        <span class="conn-platform-badge">{{ formatPlatform(section.arrival!.platform) }}</span>
      }
    </div>

  } @else if (section.type === 'walk') {

    <!-- Walk connector (no stop dot) -->
    <div class="conn-walk">
      <span class="conn-leg-line conn-leg-line--walk"></span>
      <span class="conn-walk-label">
        <i class="fa-light fa-person-walking"></i>
        {{ 'trip.planner.connection.walk' | translate: { duration: section.walkDuration } }}
      </span>
    </div>

  }

}
```

---

## 5. CSS — `trip-planner.css`

Replace the existing `.conn-row`, `.conn-main`, `.conn-times`, `.conn-arrow`, `.conn-duration`, `.conn-tags`, `.conn-select-btn` block with the following new rules. The `.connections-list`, `.tp-section--fill` classes stay unchanged.

### Card container

```css
.conn-card {
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.conn-card:hover {
  border-color: #94a3b8;
}

.conn-card--selected {
  border-color: #1a6b3c;
  background: #f0faf4;
}
```

### Card header

```css
.conn-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.3rem;
}

.conn-route {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--navy-900);
}

.conn-expand-btn {
  background: none;
  border: none;
  padding: 0.2rem;
  color: #94a3b8;
  cursor: pointer;
  line-height: 1;
  flex-shrink: 0;
}

.conn-expand-btn:hover { color: var(--navy-900); }
```

### Metadata row

```css
.conn-meta {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.conn-meta-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: #64748b;
}

.conn-meta-item i { font-size: 0.8rem; }
```

### Timeline bar

```css
.conn-timeline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.conn-timeline-time {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--navy-900);
  flex-shrink: 0;
}

.conn-timeline-bar {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0;
}

.conn-timeline-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #0079c3;
  flex-shrink: 0;
}

.conn-timeline-line {
  flex: 1;
  height: 2px;
  background: #0079c3;
}
```

### Expanded detail

```css
.conn-detail {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
}

/* Stop row: dot + time + station + platform */
.conn-stop {
  display: grid;
  grid-template-columns: 14px auto 1fr auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.1rem 0;
}

.conn-stop-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #0079c3;
  border: 2px solid #fff;
  outline: 2px solid #0079c3;
  flex-shrink: 0;
}

.conn-stop-time {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--navy-900);
  white-space: nowrap;
}

.conn-stop-station {
  font-size: 0.85rem;
  color: var(--navy-900);
  text-align: right;
}

.conn-platform-badge {
  font-size: 0.7rem;
  font-weight: 600;
  color: #64748b;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 0.1rem 0.35rem;
  white-space: nowrap;
  flex-shrink: 0;
}

/* Leg row: vertical line + train info */
.conn-leg {
  display: flex;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.conn-leg-line {
  width: 2px;
  background: #0079c3;
  margin-left: 6px;   /* align with centre of 14px dot column */
  flex-shrink: 0;
  align-self: stretch;
  min-height: 36px;
}

.conn-leg-line--walk {
  background: repeating-linear-gradient(
    to bottom,
    #94a3b8 0, #94a3b8 4px,
    transparent 4px, transparent 8px
  );
}

.conn-leg-body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.conn-train {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.82rem;
  font-weight: 700;
}

.conn-train i { font-size: 0.85rem; }

.conn-train-type {
  font-weight: 400;
  color: #64748b;
}

.conn-leg-direction {
  font-size: 0.78rem;
  color: #64748b;
}

/* Walk row */
.conn-walk {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.2rem 0;
}

.conn-walk-label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: #64748b;
}
```

---

## 6. i18n keys

Add to all locale files (e.g. `assets/i18n/en.json`, `de.json`, `fr.json`):

```json
"trip": {
  "planner": {
    "transfer":  "transfer",
    "transfers": "transfers",
    "connection": {
      "direction": "Direction",
      "walk":      "Walk {{duration}} min"
    }
  }
}
```

> Note: `trip.planner.transfer` (singular) and `trip.planner.transfers` (plural) are new; the existing `conn.transfers` tag used a bare count string.

---

## 7. Out of scope

- No changes to the `getConnectionJourneys` call — it fetches passList coordinates only and is unaffected.
- No new backend routes — all section detail (platform, journey name, direction, walk duration) is already returned by the existing `/api/v1/transport/connections` endpoint; we are only mapping more fields in the frontend.
- No changes to road trip type, stop builder, schedule step, Things to Do, or save step.
- No changes to how the selected connection's `routeCoordinates` are used on the map.
- Category-to-label mapping (`categoryLabel`) is kept client-side; no API changes needed.
