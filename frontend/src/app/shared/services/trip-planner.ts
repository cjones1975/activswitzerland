import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map, of, debounceTime, skip } from 'rxjs';
import { PlannedTrip, TripStop, TripConnection, SavedTrip } from '../../models/trip';
import { Attraction } from '../../models/attraction';

const EMPTY_TRIP: PlannedTrip = { type: 'road', stops: [] };
const DRAFT_KEY = 'activ_trip_draft';

@Injectable({ providedIn: 'root' })
export class TripPlannerService {
  private http = inject(HttpClient);

  private _trip$ = new BehaviorSubject<PlannedTrip>({ ...EMPTY_TRIP });
  private _routeCoordinates$ = new BehaviorSubject<[number, number][]>([]);
  private pendingAttractionIds = new Set<string>();
  private attractionCache = new Map<string, Attraction>();

  /** Bumped whenever new attractions are cached, so consumers can react without storing full objects in state. */
  readonly attractionCacheVersion = signal(0);

  readonly trip$: Observable<PlannedTrip> = this._trip$.asObservable();
  readonly routeCoordinates$: Observable<[number, number][]> = this._routeCoordinates$.asObservable();

  get snapshot(): PlannedTrip { return this._trip$.value; }

  constructor() {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved) as { type: 'road' | 'rail'; stops: TripStop[]; name?: string; routeCoordinates?: [number, number][] };
        if (draft.stops?.length > 0) {
          this._trip$.next({ type: draft.type ?? 'road', stops: draft.stops, name: draft.name, routeCoordinates: draft.routeCoordinates });
          if (draft.routeCoordinates?.length) {
            this._routeCoordinates$.next(draft.routeCoordinates);
          }
        }
      }
    } catch {}

    this._trip$.pipe(debounceTime(300), skip(1)).subscribe(trip => {
      if (trip.stops.length > 0) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          type: trip.type,
          stops: trip.stops,
          name: trip.name,
          routeCoordinates: trip.routeCoordinates,
        }));
      }
    });
  }

  clearDraft(): void {
    localStorage.removeItem(DRAFT_KEY);
  }

  setType(type: 'road' | 'rail'): void {
    this._trip$.next({ type, stops: [] });
    this._routeCoordinates$.next([]);
  }

  setStops(stops: TripStop[]): void {
    const ids = new Set(stops.map(s => s.stationId));
    const current = this._trip$.value.attractionSelections ?? {};
    const pruned = Object.fromEntries(Object.entries(current).filter(([k]) => ids.has(k)));
    this._trip$.next({ ...this._trip$.value, stops, attractionSelections: pruned });
  }

  setName(name: string): void {
    this._trip$.next({ ...this._trip$.value, name });
  }

  loadSavedTrip(trip: SavedTrip): void {
    this._trip$.next({
      type: trip.type,
      stops: trip.stops,
      routeCoordinates: trip.routeCoordinates,
      name: trip.name,
    });
    this._routeCoordinates$.next(trip.routeCoordinates);
    this.pendingAttractionIds = new Set(trip.attractionIds ?? []);
  }

  setConnections(connections: TripConnection[]): void {
    this._trip$.next({ ...this._trip$.value, connections, selectedConnection: undefined });
  }

  selectConnection(connection: TripConnection): void {
    this._trip$.next({ ...this._trip$.value, selectedConnection: connection });
  }

  setAttractions(attractions: Attraction[]): void {
    this._trip$.next({ ...this._trip$.value, attractions });
  }

  setRouteCoordinates(coords: [number, number][]): void {
    this._routeCoordinates$.next(coords);
    this._trip$.next({ ...this._trip$.value, routeCoordinates: coords });
  }

  toggleAttraction(stationId: string, attractionId: string): void {
    const current = this._trip$.value.attractionSelections ?? {};
    const selected = new Set(current[stationId] ?? []);
    selected.has(attractionId) ? selected.delete(attractionId) : selected.add(attractionId);
    this._trip$.next({
      ...this._trip$.value,
      attractionSelections: { ...current, [stationId]: [...selected] },
    });
  }

  getSelections(stationId: string): string[] {
    return this._trip$.value.attractionSelections?.[stationId] ?? [];
  }

  allSelectedAttractionIds(): string[] {
    const sel = this._trip$.value.attractionSelections ?? {};
    return [...new Set(Object.values(sel).flat())];
  }

  hydrateSelections(stationId: string, nearbyAttractionIds: string[]): void {
    if (this.pendingAttractionIds.size === 0) return;
    const matched = nearbyAttractionIds.filter(id => this.pendingAttractionIds.has(id));
    if (matched.length === 0) return;
    const current = this._trip$.value.attractionSelections ?? {};
    this._trip$.next({
      ...this._trip$.value,
      attractionSelections: {
        ...current,
        [stationId]: [...new Set([...(current[stationId] ?? []), ...matched])],
      },
    });
  }

  buildRoadRoute(stops: TripStop[]): Observable<[number, number][]> {
    if (stops.length < 2) return of([]);
    const coords = stops.map(s => `${s.lon},${s.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    return this.http.get<any>(url).pipe(
      map(res => res.routes?.[0]?.geometry?.coordinates ?? []),
    );
  }

  buildRailRoute(stops: TripStop[]): [number, number][] {
    return stops.map(s => [s.lon, s.lat]);
  }

  cacheAttractions(attractions: Attraction[]): void {
    let changed = false;
    for (const attraction of attractions) {
      if (!this.attractionCache.has(attraction.identifier)) {
        this.attractionCache.set(attraction.identifier, attraction);
        changed = true;
      }
    }
    if (changed) this.attractionCacheVersion.update(v => v + 1);
  }

  getAttraction(id: string): Attraction | undefined {
    return this.attractionCache.get(id);
  }

  reset(): void {
    this._trip$.next({ ...EMPTY_TRIP });
    this._routeCoordinates$.next([]);
    this.attractionCache.clear();
    this.attractionCacheVersion.set(0);
  }
}
