import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Attraction, AttractionsResponse } from '../../models/attraction';

interface AttractionResponse {
  success: boolean;
  data: {
    data: Attraction;
  };
}

export interface AttractionsPage {
  attractions: Attraction[];
  totalElements: number;
}

@Injectable({ providedIn: 'root' })
export class AttractionsService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/v1/myswitzerland`;

  getAttractions(params: {
    language: string;
    page: number;
    hitsPerPage: number;
    placeId?: string;
    geoDist?: string; // "lat,lon,radiusMeters"
  }): Observable<AttractionsPage> {
    let httpParams = new HttpParams()
      .set('language', params.language)
      .set('page', params.page)
      .set('hitsPerPage', params.hitsPerPage)
      .set('expand', 'true')
      .set('translate', 'true')
      .set('stripHtml', 'false');
    if (params.placeId) httpParams = httpParams.set('placeId', params.placeId);
    if (params.geoDist) httpParams = httpParams.set('geo.dist', params.geoDist);

    return this.http
      .get<AttractionsResponse>(this.baseUrl + '/attractions', { params: httpParams })
      .pipe(map(res => ({
        attractions: res.data.data,
        totalElements: res.data.meta?.page?.totalElements ?? 0,
      })));
  }

  searchAttractions(params: {
    language: string;
    page: number;
    search: string;
    hitsPerPage: number;
    placeId?: string;
    geoDist?: string; // "lat,lon,radiusMeters"
    translate: boolean;
    stripHtml: boolean;
  }): Observable<AttractionsPage> {
    let httpParams = new HttpParams()
      .set('language', params.language)
      .set('page', params.page)
      .set('search', params.search)
      .set('hitsPerPage', params.hitsPerPage)
      .set('expand', 'true')
      .set('translate', String(params.translate))
      .set('stripHtml', String(params.stripHtml));
    if (params.placeId) httpParams = httpParams.set('placeId', params.placeId);
    if (params.geoDist) httpParams = httpParams.set('geo.dist', params.geoDist);

    return this.http
      .get<AttractionsResponse>(this.baseUrl + '/searchattractions', { params: httpParams })
      .pipe(map(res => ({
        attractions: res.data.data,
        totalElements: res.data.meta?.page?.totalElements ?? 0,
      })));
  }

  getAttraction(id: string, language: string): Observable<Attraction> {
    const httpParams = new HttpParams().set('language', language);
    return this.http
      .get<AttractionResponse>(`${this.baseUrl}/attractions/${id}`, { params: httpParams })
      .pipe(map(res => res.data.data));
  }
}
