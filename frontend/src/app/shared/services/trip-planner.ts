import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map, of, debounceTime, skip } from 'rxjs';
import {
  PlannedTrip, TripStop, TripDateMode, TripDateRange,
  TripConnection, TripConnectionLeg, SavedTrip,
  ActivityKind, TripActivitySelection,
} from '../../models/trip';

const EMPTY_TRIP: PlannedTrip = {
  type: 'road',
  dateMode: 'dates',
  range: { mode: 'dates' },
  stops: [],
  activities: [],
};

const DRAFT_KEY = 'activ_trip_draft_v2';

@Injectable({ providedIn: 'root' })
export class TripPlannerService {
  private http = inject(HttpClient);

  private _trip$ = new BehaviorSubject<PlannedTrip>({ ...EMPTY_TRIP });
  private _routeCoordinates$ = new BehaviorSubject<[number, number][]>([]);

  /** 1-5, owned here so sibling step components can coordinate wizard navigation without a shared parent. Only 1-2 have real content this phase. */
  readonly step = signal(1);

  /** Set when the in-progress trip was loaded from a saved trip — lets Step 5 update it in place instead of duplicating. */
  readonly loadedTripId = signal<string | null>(null);

  nextStep(): void { this.step.update(s => Math.min(s + 1, 5)); }
  prevStep(): void { this.step.update(s => Math.max(s - 1, 1)); }
  resetStep(): void { this.step.set(1); }

  readonly trip$: Observable<PlannedTrip> = this._trip$.asObservable();
  readonly routeCoordinates$: Observable<[number, number][]> = this._routeCoordinates$.asObservable();

  get snapshot(): PlannedTrip { return this._trip$.value; }

  constructor() {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved) as PlannedTrip;
        if (draft.stops?.length > 0) {
          this._trip$.next(draft);
          if (draft.routeCoordinates?.length) {
            this._routeCoordinates$.next(draft.routeCoordinates);
          }
        }
      }
    } catch {}

    this._trip$.pipe(debounceTime(300), skip(1)).subscribe(trip => {
      if (trip.stops.length > 0) {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(trip));
      }
    });
  }

  clearDraft(): void {
    sessionStorage.removeItem(DRAFT_KEY);
  }

  reset(): void {
    this._trip$.next({ ...EMPTY_TRIP });
    this._routeCoordinates$.next([]);
    this.resetStep();
    this.clearDraft();
    this.loadedTripId.set(null);
  }

  setType(type: 'road' | 'rail'): void {
    this._trip$.next({ ...EMPTY_TRIP, type });
    this._routeCoordinates$.next([]);
    this.resetStep();
    this.clearDraft();
    this.loadedTripId.set(null);
  }

  setDateMode(mode: TripDateMode): void {
    this._trip$.next({ ...this._trip$.value, dateMode: mode, range: { mode } });
  }

  setOverallRange(range: TripDateRange): void {
    this._trip$.next({ ...this._trip$.value, range });
  }

  setName(name: string): void {
    this._trip$.next({ ...this._trip$.value, name });
  }

  /** Ordered, fully-resolved stops (each already carries its own role — the component owns departure/via/destination assignment). */
  setStops(stops: TripStop[]): void {
    const validIds = new Set(stops.map(s => s.id));
    const connections = (this._trip$.value.connections ?? [])
      .filter(leg => validIds.has(leg.fromStopId) && validIds.has(leg.toStopId));
    this._trip$.next({ ...this._trip$.value, stops, connections });
  }

  updateStopDays(stopId: string, days: number): void {
    const stops = this._trip$.value.stops.map(s => s.id === stopId ? { ...s, days } : s);
    this._trip$.next({ ...this._trip$.value, stops });
  }

  // ── Rail connections (one per leg) ──────────────────────────────────────
  setConnectionLeg(fromStopId: string, toStopId: string, connection: TripConnection): void {
    const legs = (this._trip$.value.connections ?? [])
      .filter(l => !(l.fromStopId === fromStopId && l.toStopId === toStopId));
    legs.push({ fromStopId, toStopId, connection });
    this._trip$.next({ ...this._trip$.value, connections: legs });
  }

  skipConnectionLeg(fromStopId: string, toStopId: string): void {
    const legs = (this._trip$.value.connections ?? [])
      .filter(l => !(l.fromStopId === fromStopId && l.toStopId === toStopId));
    legs.push({ fromStopId, toStopId, skipped: true });
    this._trip$.next({ ...this._trip$.value, connections: legs });
  }

  getConnectionLeg(fromStopId: string, toStopId: string): TripConnectionLeg | undefined {
    return this._trip$.value.connections?.find(l => l.fromStopId === fromStopId && l.toStopId === toStopId);
  }

  // ── Activities (Step 3) ──────────────────────────────────────────────
  addActivity(selection: Omit<TripActivitySelection, 'id'>): void {
    const activities = [...this._trip$.value.activities, { ...selection, id: crypto.randomUUID() }];
    this._trip$.next({ ...this._trip$.value, activities });
  }

  removeActivity(activityId: string): void {
    const activities = this._trip$.value.activities.filter(a => a.id !== activityId);
    this._trip$.next({ ...this._trip$.value, activities });
  }

  isActivityAdded(stopId: string, kind: ActivityKind, refId: string): boolean {
    return this._trip$.value.activities.some(a => a.stopId === stopId && a.kind === kind && a.refId === refId);
  }

  getActivitiesForStop(stopId: string): TripActivitySelection[] {
    return this._trip$.value.activities.filter(a => a.stopId === stopId);
  }

  // ── Route ─────────────────────────────────────────────────────────────
  buildRoadRoute(stops: TripStop[]): Observable<[number, number][]> {
    if (stops.length < 2) return of([]);
    const coords = stops.map(s => `${s.lon},${s.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    return this.http.get<any>(url).pipe(
      map(res => {
        if (res.code !== 'Ok' || !res.routes?.[0]) {
          throw new Error('NO_ROAD_ROUTE');
        }
        return res.routes[0].geometry.coordinates;
      }),
    );
  }

  /** Stitches each leg's picked connection geometry where available, falling back to a straight line for unresolved/skipped legs. */
  buildRailRoute(stops: TripStop[]): [number, number][] {
    const coords: [number, number][] = [];
    for (let i = 0; i < stops.length - 1; i++) {
      const leg = this.getConnectionLeg(stops[i].id, stops[i + 1].id);
      const legCoords = leg?.connection?.routeCoordinates;
      if (coords.length === 0) coords.push([stops[i].lon, stops[i].lat]);
      if (legCoords && legCoords.length >= 2) {
        coords.push(...legCoords.slice(1));
      } else {
        coords.push([stops[i + 1].lon, stops[i + 1].lat]);
      }
    }
    return coords;
  }

  setRouteCoordinates(coords: [number, number][]): void {
    this._routeCoordinates$.next(coords);
    this._trip$.next({ ...this._trip$.value, routeCoordinates: coords });
  }

  loadSavedTrip(trip: SavedTrip): void {
    const { _id, createdAt, ...planned } = trip;
    this._trip$.next(planned);
    this._routeCoordinates$.next(planned.routeCoordinates ?? []);
    this.loadedTripId.set(_id ?? null);
  }
}
