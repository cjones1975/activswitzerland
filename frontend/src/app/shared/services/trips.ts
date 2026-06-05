import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SavedTrip } from '../../models/trip';

interface TripsResponse  { success: boolean; data: SavedTrip[]; }
interface TripResponse   { success: boolean; data: SavedTrip; }

@Injectable({ providedIn: 'root' })
export class TripsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/v1/trips`;

  getTrips(): Observable<SavedTrip[]> {
    return this.http.get<TripsResponse>(this.base).pipe(map(r => r.data));
  }

  saveTrip(trip: SavedTrip): Observable<SavedTrip> {
    return this.http.post<TripResponse>(this.base, trip).pipe(map(r => r.data));
  }

  updateTrip(id: string, trip: Partial<SavedTrip>): Observable<SavedTrip> {
    return this.http.put<TripResponse>(`${this.base}/${id}`, trip).pipe(map(r => r.data));
  }

  deleteTrip(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
