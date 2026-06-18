import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TripStop, TripConnection, TripSection } from '../../models/trip';

interface LocationResult {
  id: string;
  name: string;
  coordinate: { x: number; y: number };
  type: string;
}

interface LocationsResponse {
  success: boolean;
  data: { stations: LocationResult[] };
}

interface PassListStation {
  name: string;
  coordinate?: { x: number; y: number };
}

interface SectionStop {
  station:    { name: string };
  departure?: string;
  arrival?:   string;
  platform?:  string;
}

interface SectionJourney {
  name:      string;
  category:  string;
  number:    string;
  to:        string;
  passList?: { station: PassListStation }[];
}

interface SectionWalk {
  duration: number;
}

interface ConnectionSection {
  departure?: SectionStop;
  arrival?:   SectionStop;
  journey?:   SectionJourney;
  walk?:      SectionWalk;
}

interface ConnectionResult {
  from:      { departure: string; station: { name: string } };
  to:        { arrival: string;   station: { name: string } };
  duration:  string;
  transfers: number;
  products:  string[];
  sections:  ConnectionSection[];
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
  private base = `${environment.apiUrl}/api/v1/transport`;

  searchLocations(query: string, tripType: 'road' | 'rail' = 'rail'): Observable<TripStop[]> {
    const type = tripType === 'road' ? 'address' : 'station';
    const params = new HttpParams().set('location', query).set('type', type);
    return this.http.get<LocationsResponse>(`${this.base}/locations`, { params }).pipe(
      map(res => (res.data.stations ?? [])
        .filter(s => s.coordinate?.x && s.coordinate?.y)
        .map(s => ({
          stationId: s.id,
          name: s.name,
          lon: s.coordinate.y,
          lat: s.coordinate.x,
        }))
      )
    );
  }

  getConnections(stops: TripStop[], date: string, time: string): Observable<TripConnection[]> {
    let params = new HttpParams()
      .set('limit', 6)
      .set('from', stops[0].name)
      .set('to', stops[stops.length - 1].name);

    const via = stops.slice(1, -1).map(s => s.name);
    via.forEach(v => { params = params.append('via[]', v); });

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
        sections:  this.mapSections(c.sections ?? []),
      })))
    );
  }

  getConnectionJourneys(stops: TripStop[], date: string, time: string): Observable<[number, number][][]> {
    let params = new HttpParams()
      .set('from', stops[0].stationId)
      .set('to', stops[stops.length - 1].stationId)
      .set('fields[]', 'connections/sections/journey/passList/station')
      .set('isArrivalTime', 'false');

    const via = stops.slice(1, -1).map(s => s.stationId);
    via.forEach(v => { params = params.append('via', v); });

    if (date) params = params.set('date', date);
    if (time) params = params.set('time', time);

    return this.http.get<JourneysResponse>(`${this.base}/connections/journeys`, { params }).pipe(
      map(res => (res.data.connections ?? []).map(c => this.extractPassListCoords(c.sections))),
      catchError(() => of([]))
    );
  }

  private mapSections(sections: ConnectionSection[]): TripSection[] {
    return sections
      .filter(s => s.journey || s.walk)
      .map(s => {
        if (s.walk) {
          return { type: 'walk' as const, walkDuration: s.walk.duration };
        }
        return {
          type: 'journey' as const,
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
