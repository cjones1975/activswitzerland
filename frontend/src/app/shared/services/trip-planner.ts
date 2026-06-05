import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map, catchError, of } from 'rxjs';
import { PlannedTrip, TripStop, TripConnection } from '../../models/trip';
import { Attraction } from '../../models/attraction';

const EMPTY_TRIP: PlannedTrip = { type: 'road', stops: [] };

@Injectable({ providedIn: 'root' })
export class TripPlannerService {
  private http = inject(HttpClient);

  private _trip$ = new BehaviorSubject<PlannedTrip>({ ...EMPTY_TRIP });
  private _routeCoordinates$ = new BehaviorSubject<[number, number][]>([]);

  readonly trip$: Observable<PlannedTrip> = this._trip$.asObservable();
  readonly routeCoordinates$: Observable<[number, number][]> = this._routeCoordinates$.asObservable();

  get snapshot(): PlannedTrip { return this._trip$.value; }

  setType(type: 'road' | 'rail'): void {
    this._trip$.next({ type, stops: [] });
    this._routeCoordinates$.next([]);
  }

  setStops(stops: TripStop[]): void {
    this._trip$.next({ ...this._trip$.value, stops });
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

  buildRoadRoute(stops: TripStop[]): Observable<[number, number][]> {
    if (stops.length < 2) return of([]);
    const coords = stops.map(s => `${s.lon},${s.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    return this.http.get<any>(url).pipe(
      map(res => res.routes?.[0]?.geometry?.coordinates ?? []),
      catchError(() => of(stops.map(s => [s.lon, s.lat] as [number, number])))
    );
  }

  buildRailRoute(stops: TripStop[]): [number, number][] {
    return stops.map(s => [s.lon, s.lat]);
  }

  reset(): void {
    this._trip$.next({ ...EMPTY_TRIP });
    this._routeCoordinates$.next([]);
  }
}
