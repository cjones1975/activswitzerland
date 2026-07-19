import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TrailRoute, TrailRoutesResponse } from '../../models/trail-route';
import { ElevationProfile, ElevationProfileResponse } from '../../models/elevation-profile';

export type TrailKind = 'hike' | 'bike';

const KIND_PATH: Record<TrailKind, string> = {
  hike: 'hikes',
  bike: 'bikes',
};

interface RouteStagesResponse {
  success: boolean;
  data: TrailRoute;
}

@Injectable({ providedIn: 'root' })
export class TrailRoutesService {
  private http = inject(HttpClient);

  getRoutes(kind: TrailKind, lat: number, lon: number, lang: string, radius = 30000): Observable<TrailRoute[]> {
    const params = new HttpParams()
      .set('lat', lat)
      .set('lon', lon)
      .set('radius', radius)
      .set('lang', lang);

    return this.http
      .get<TrailRoutesResponse>(`${environment.apiUrl}/api/v1/${KIND_PATH[kind]}`, { params })
      .pipe(map(res => res.data));
  }

  downloadGpx(kind: TrailKind, route: TrailRoute): Observable<Blob> {
    return this.http.post(
      `${environment.apiUrl}/api/v1/${KIND_PATH[kind]}/gpx`,
      { name: route.name, stages: route.stages.map(s => ({ geometry: s.geometry })) },
      { responseType: 'blob' },
    );
  }

  getElevationProfile(kind: TrailKind, route: TrailRoute): Observable<ElevationProfile> {
    return this.http
      .post<ElevationProfileResponse>(
        `${environment.apiUrl}/api/v1/${KIND_PATH[kind]}/elevation`,
        { stages: route.stages.map(s => ({ geometry: s.geometry })) },
      )
      .pipe(map(res => res.data));
  }

  getRouteStages(kind: TrailKind, routeNumber: string | number, lang: string): Observable<TrailRoute> {
    const params = new HttpParams().set('lang', lang);

    return this.http
      .get<RouteStagesResponse>(`${environment.apiUrl}/api/v1/${KIND_PATH[kind]}/${routeNumber}/stages`, { params })
      .pipe(map(res => res.data));
  }
}
