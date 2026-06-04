import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ForecastViewModel, buildForecastViewModel } from '../../models/weather';

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/v1/weather`;

  getWeather(lat: number, lon: number): Observable<ForecastViewModel> {
    const params = new HttpParams()
      .set('lat', String(lat))
      .set('lon', String(lon));
    return this.http
      .get<{ success: boolean; data: any }>(this.baseUrl, { params })
      .pipe(map(res => buildForecastViewModel(res.data)));
  }
}
