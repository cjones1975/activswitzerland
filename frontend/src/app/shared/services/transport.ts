import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TripStop, TripConnection } from '../../models/trip';

interface LocationResult {
  id: string;
  name: string;
  coordinate: { x: number; y: number };
  type: string;
}

interface LocationsResponse {
  stations: LocationResult[];
}

interface ConnectionLeg {
  departure: { station: { name: string }; departure: string };
  arrival:   { station: { name: string }; arrival: string };
  line?:     { name: string; category: string };
}

interface ConnectionResult {
  from:      { departure: string; station: { name: string } };
  to:        { arrival: string;   station: { name: string } };
  duration:  string;
  transfers: number;
  products:  string[];
  sections:  { journey?: { passList?: { station: { name: string }; coordinate?: { x: number; y: number } }[] } }[];
}

interface ConnectionsResponse {
  connections: ConnectionResult[];
}

@Injectable({ providedIn: 'root' })
export class TransportService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/v1/transport`;

  searchLocations(query: string): Observable<TripStop[]> {
    const params = new HttpParams().set('query', query);
    return this.http.get<LocationsResponse>(`${this.base}/locations`, { params }).pipe(
      map(res => (res.stations ?? [])
        .filter(s => s.coordinate?.x && s.coordinate?.y)
        .map(s => ({
          stationId: s.id,
          name: s.name,
          lon: s.coordinate.x,
          lat: s.coordinate.y,
        }))
      )
    );
  }

  getConnections(stops: TripStop[], date: string, time: string): Observable<TripConnection[]> {
    let params = new HttpParams()
      .set('from', stops[0].name)
      .set('to', stops[stops.length - 1].name);

    const via = stops.slice(1, -1).map(s => s.name);
    via.forEach(v => { params = params.append('via[]', v); });

    if (date) params = params.set('date', date);
    if (time) params = params.set('time', time);

    return this.http.get<ConnectionsResponse>(`${this.base}/connections`, { params }).pipe(
      map(res => (res.connections ?? []).map(c => ({
        from:      c.from.station.name,
        to:        c.to.station.name,
        departure: c.from.departure,
        arrival:   c.to.arrival,
        duration:  c.duration,
        transfers: c.transfers,
        products:  c.products ?? [],
      })))
    );
  }
}
