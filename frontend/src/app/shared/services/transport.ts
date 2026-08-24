import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TripStop, TripConnection } from '../../models/trip';
import { LangService } from './lang';
import { mapSections, ConnectionSection, ConnectionResult } from '../utils/trip-sections';

/** Raw hit from the location search — callers turn this into a full TripStop (assigning id/role/range). */
export interface LocationSearchResult {
  externalId: string;
  name: string;
  lat: number;
  lon: number;
  type: 'station' | 'address';
  modes: string[];
}

interface LocationResult {
  id: string;
  name: string;
  coordinate: { x: number; y: number };
  type: 'station' | 'address';
  modes: string[];
}

interface LocationsResponse {
  success: boolean;
  data: { stations: LocationResult[] };
}

interface ConnectionsResponse {
  success: boolean;
  data: { connections: ConnectionResult[] };
}

interface JourneysResponse {
  success: boolean;
  data: {
    connections: {
      sections: ConnectionSection[];
    }[];
  };
}

@Injectable({ providedIn: 'root' })
export class TransportService {
  private http = inject(HttpClient);
  private langSvc = inject(LangService);
  private base = `${environment.apiUrl}/api/v1/transport`;

  searchLocations(query: string, tripType: 'road' | 'rail' = 'rail'): Observable<LocationSearchResult[]> {
    const type = tripType === 'road' ? 'address' : 'station';
    const params = new HttpParams().set('location', query).set('type', type).set('lang', this.langSvc.current);
    return this.http.get<LocationsResponse>(`${this.base}/locations`, { params }).pipe(
      map(res => (res.data.stations ?? [])
        .filter(s => s.coordinate?.x && s.coordinate?.y)
        .map(s => ({
          externalId: s.id,
          name: s.name,
          lon: s.coordinate.y,
          lat: s.coordinate.x,
          type: s.type,
          modes: s.modes ?? [],
        }))
      )
    );
  }

  getConnections(stops: TripStop[], date: string, time: string): Observable<TripConnection[]> {
    let params = new HttpParams()
      .set('limit', 6)
      .set('from', stops[0].externalId ?? stops[0].name)
      .set('to', stops[stops.length - 1].externalId ?? stops[stops.length - 1].name);

    if (date) params = params.set('date', date);
    if (time) params = params.set('time', time);

    return this.http.get<ConnectionsResponse>(`${this.base}/connections`, { params }).pipe(
      map(res => (res.data.connections ?? []).map(c => ({
        from:      c.from.station.name,
        to:        c.to.station.name,
        departure: c.from.departure,
        arrival:   c.to.arrival,
        duration:  c.duration,
        transfers: c.transfers,
        products:  c.products ?? [],
        routeCoordinates: this.extractPassListCoords(c.sections),
        sections:  mapSections(c.sections ?? []),
      })))
    );
  }

  getConnectionJourneys(stops: TripStop[], date: string, time: string): Observable<[number, number][][]> {
    let params = new HttpParams()
      .set('from', stops[0].externalId ?? stops[0].name)
      .set('to', stops[stops.length - 1].externalId ?? stops[stops.length - 1].name)
      .set('isArrivalTime', 'false');

    if (date) params = params.set('date', date);
    if (time) params = params.set('time', time);

    return this.http.get<JourneysResponse>(`${this.base}/connections/journeys`, { params }).pipe(
      map(res => (res.data.connections ?? []).map(c => this.extractPassListCoords(c.sections))),
      catchError(() => of([]))
    );
  }

  private extractPassListCoords(
    sections: ConnectionSection[]
  ): [number, number][] {
    const coords: [number, number][] = [];
    for (let i = 0; i < sections.length; i++) {
      const passList = sections[i].journey?.passList ?? [];
      const start = coords.length > 0 ? 1 : 0;
      for (let j = start; j < passList.length; j++) {
        const coord = passList[j].station?.coordinate;
        if (coord?.x != null && coord?.y != null) {
          coords.push([coord.y, coord.x]);
        }
      }
    }
    return coords;
  }
}
