import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

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
  private baseUrl = 'http://localhost:3000/api/v1/myswitzerland';

  getTopAttractions(params: {
    language: string;
    page: number;
    hitsPerPage: number;
    placeId: string;
    expand: boolean;
    translate: boolean;
    stripHtml: boolean;
    top: boolean;
  }): Observable<Attraction[]> {
    const httpParams = new HttpParams()
      .set('language', params.language)
      .set('page', params.page)
      .set('hitsPerPage', params.hitsPerPage)
      .set('placeId', params.placeId)
      .set('expand', String(params.expand))
      .set('translate', String(params.translate))
      .set('stripHtml', String(params.stripHtml))
      .set('top', String(params.top));

    return this.http
      .get<AttractionsResponse>(this.baseUrl + '/topattractions', { params: httpParams })
      .pipe(map(res => res.data.data));
  }


  getAttractions(params: {
    language: string;
    page: number;
    hitsPerPage: number;
    placeId: string;
  }): Observable<AttractionsPage> {
    const httpParams = new HttpParams()
      .set('language', params.language)
      .set('page', params.page)
      .set('hitsPerPage', params.hitsPerPage)
      .set('placeId', params.placeId)
      .set('expand', 'false')
      .set('translate', 'true')
      .set('stripHtml', 'false');

    return this.http
      .get<AttractionsResponse>(this.baseUrl + '/attractions', { params: httpParams })
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
