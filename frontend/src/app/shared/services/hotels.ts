import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { HotelDeeplinkParams, HotelDestinationMapping } from '../../models/hotel-destination';

@Injectable({ providedIn: 'root' })
export class HotelsService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/v1/hotels`;

  // Loaded once for the app's lifetime — a small, effectively-static reference table (~48 rows),
  // same reasoning as Country. `mappingFor` reads this signal directly so any `computed()` built on
  // top of it (e.g. destination-detail's hasHotelMapping) reacts once the initial load resolves,
  // rather than only ever seeing "not loaded yet".
  private destinations = signal<HotelDestinationMapping[]>([]);

  constructor() {
    this.http
      .get<{ success: boolean; data: HotelDestinationMapping[] }>(`${this.baseUrl}/destinations`)
      .pipe(map(res => res.data))
      .subscribe({
        next: (data) => this.destinations.set(data),
        error: () => this.destinations.set([]),
      });
  }

  mappingFor(identifier: string): HotelDestinationMapping | undefined {
    return this.destinations().find(d => d.identifier === identifier);
  }

  getDeeplink(params: HotelDeeplinkParams): Observable<string> {
    const httpParams = new HttpParams()
      .set('identifier', params.identifier)
      .set('checkin', params.checkin)
      .set('checkout', params.checkout)
      .set('groupAdults', params.groupAdults)
      .set('groupChildren', params.groupChildren)
      .set('noRooms', params.noRooms)
      .set('currency', params.currency)
      .set('lang', params.lang);

    return this.http
      .get<{ success: boolean; data: { url: string } }>(`${this.baseUrl}/deeplink`, { params: httpParams })
      .pipe(map(res => res.data.url));
  }
}
