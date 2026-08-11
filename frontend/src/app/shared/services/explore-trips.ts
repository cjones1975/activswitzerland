import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PublicTrip } from '../../models/trip';

export interface ExploreTripsFilter {
  skip?: number;
  limit?: number;
  type?: 'all' | 'road' | 'rail';
  sort?: 'createdAt' | 'likes';
  order?: 'asc' | 'desc';
  minDistance?: number;
  maxDistance?: number;
}

interface PublicTripsResponse { success: boolean; hasMore: boolean; data: PublicTrip[]; }
interface LikeResponse { success: boolean; data: { likeCount: number; liked: boolean }; }

@Injectable({ providedIn: 'root' })
export class ExploreTripsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/v1/trips`;

  getPublicTrips(filter: ExploreTripsFilter = {}): Observable<{ trips: PublicTrip[]; hasMore: boolean }> {
    let params = new HttpParams();
    if (filter.skip != null) params = params.set('skip', filter.skip);
    if (filter.limit != null) params = params.set('limit', filter.limit);
    if (filter.type && filter.type !== 'all') params = params.set('type', filter.type);
    if (filter.sort) params = params.set('sort', filter.sort);
    if (filter.order) params = params.set('order', filter.order);
    if (filter.minDistance != null) params = params.set('minDistance', filter.minDistance);
    if (filter.maxDistance != null) params = params.set('maxDistance', filter.maxDistance);

    return this.http.get<PublicTripsResponse>(`${this.base}/public`, { params })
      .pipe(map(r => ({ trips: r.data, hasMore: r.hasMore })));
  }

  toggleLike(id: string): Observable<{ likeCount: number; liked: boolean }> {
    return this.http.post<LikeResponse>(`${this.base}/${id}/like`, {}).pipe(map(r => r.data));
  }

  getTripBySlug(slug: string): Observable<PublicTrip> {
    return this.http.get<{ success: boolean; data: PublicTrip }>(`${this.base}/slug/${slug}`)
      .pipe(map(r => r.data));
  }
}
