import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface AdminHikeStage {
  stageId: string;
  stageNumber: number;
  title: string;
  geometry: { type: 'MultiLineString'; coordinates: [number, number][][] };
  geometryWgs84: { type: 'MultiLineString'; coordinates: [number, number][][] };
}

export interface AdminHike {
  _id: string;
  routeNumber: string;
  name: string;
  category: string;
  isMultiDay: boolean;
  distanceKm: number;
  distanceMiles: number;
  ascentM?: number;
  descentM?: number;
  minElevation?: number;
  maxElevation?: number;
  source: string;
  stages: AdminHikeStage[];
}

export interface HikePreview {
  distanceKm: number;
  distanceMiles: number;
  ascentM?: number;
  descentM?: number;
  minElevation?: number;
  maxElevation?: number;
  pointCount: number;
  segmentCount: number;
  stage: AdminHikeStage;
}

@Injectable({ providedIn: 'root' })
export class AdminHikesService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/v1/admin/hikes`;

  async list(): Promise<AdminHike[]> {
    const res = await firstValueFrom(this.http.get<{ data: AdminHike[] }>(this.base));
    return res.data;
  }

  async preview(gpx: string): Promise<HikePreview> {
    const res = await firstValueFrom(this.http.post<{ data: HikePreview }>(`${this.base}/preview`, { gpx }));
    return res.data;
  }

  async create(name: string, gpx: string): Promise<AdminHike> {
    const res = await firstValueFrom(this.http.post<{ data: AdminHike }>(this.base, { name, gpx }));
    return res.data;
  }

  async update(id: string, name: string): Promise<AdminHike> {
    const res = await firstValueFrom(this.http.patch<{ data: AdminHike }>(`${this.base}/${id}`, { name }));
    return res.data;
  }

  async remove(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base}/${id}`));
  }
}
