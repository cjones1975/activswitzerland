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

  getTopAttractions(params: {
    language: string;
    page: number;
    hitsPerPage: number;
    placeId?: string;
    geoDist?: string; // "lat,lon,radiusMeters"
    expand: boolean;
    translate: boolean;
    stripHtml: boolean;
    top: boolean;
  }): Observable<Attraction[]> {
    let httpParams = new HttpParams()
      .set('language', params.language)
      .set('page', params.page)
      .set('hitsPerPage', params.hitsPerPage)
      .set('expand', String(params.expand))
      .set('translate', String(params.translate))
      .set('stripHtml', String(params.stripHtml))
      .set('top', String(params.top));
    if (params.placeId) httpParams = httpParams.set('placeId', params.placeId);
    if (params.geoDist) httpParams = httpParams.set('geo.dist', params.geoDist);

    return this.http
      .get<AttractionsResponse>(this.baseUrl + '/topattractions', { params: httpParams })
      .pipe(map(res => res.data.data));
  }


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
      .set('expand', 'false')
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

  getAttractionsNearby(lat: number, lon: number, language: string, page = 0, hitsPerPage = 20): Observable<AttractionsPage> {
    return this.getAttractions({ language, page, hitsPerPage, geoDist: `${lat},${lon},10000` });
  }

  searchAttractions(params: {
    language: string;
    page: number;
    search: string;
    hitsPerPage: number;
    placeId?: string;
    geoDist?: string; // "lat,lon,radiusMeters"
    expand: boolean;
    translate: boolean;
    stripHtml: boolean;
    top: boolean;
  }): Observable<AttractionsPage> {
    let httpParams = new HttpParams()
      .set('language', params.language)
      .set('page', params.page)
      .set('search', params.search)
      .set('hitsPerPage', params.hitsPerPage)
      .set('expand', String(params.expand))
      .set('translate', String(params.translate))
      .set('stripHtml', String(params.stripHtml))
      .set('top', String(params.top));
    if (params.placeId) httpParams = httpParams.set('placeId', params.placeId);
    if (params.geoDist) httpParams = httpParams.set('geo.dist', params.geoDist);

    return this.http
      .get<AttractionsResponse>(this.baseUrl + '/searchattractions', { params: httpParams })
      .pipe(map(res => ({
        attractions: res.data.data,
        totalElements: res.data.meta?.page?.totalElements ?? 0,
      })));
  }

  searchAttractionsNearby(lat: number, lon: number, language: string, search: string, page = 0, hitsPerPage = 20): Observable<AttractionsPage> {
    return this.searchAttractions({
      language,
      page,
      search,
      hitsPerPage,
      geoDist: `${lat},${lon},10000`,
      expand: false,
      translate: true,
      stripHtml: false,
      top: false,
    });
  }

  getAttraction(id: string, language: string): Observable<Attraction> {
    const httpParams = new HttpParams().set('language', language);
    return this.http
      .get<AttractionResponse>(`${this.baseUrl}/attractions/${id}`, { params: httpParams })
      .pipe(map(res => res.data.data));
  }
}
