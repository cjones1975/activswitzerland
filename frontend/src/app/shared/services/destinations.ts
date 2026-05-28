import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Destination, DestinationsResponse } from '../../models/destination';

@Injectable({ providedIn: 'root' })
export class DestinationsService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:3000/api/v1/myswitzerland/destinations';

  getDestinations(params: {
    language: string;
    page: number;
    hitsPerPage: number;
    facets: string;
    expand: boolean;
  }): Observable<Destination[]> {
    const httpParams = new HttpParams()
      .set('language', params.language)
      .set('page', params.page)
      .set('hitsPerPage', params.hitsPerPage)
      .set('facets', params.facets)
      .set('expand', String(params.expand))
      .set('translate', 'true')
      .set('stripHtml', 'false')
      .set('top', 'false');

    return this.http
      .get<DestinationsResponse>(this.baseUrl, { params: httpParams })
      .pipe(map(res => res.data.data));
  }

  getDestination(id: string, language: string): Observable<Destination> {
    const httpParams = new HttpParams()
      .set('language', language)
      .set('translate', 'true')
      .set('stripHtml', 'false');

    return this.http
      .get<{ success: boolean; data: { data: Destination } }>(`${this.baseUrl}/${id}`, { params: httpParams })
      .pipe(map(res => res.data.data));
  }
}
