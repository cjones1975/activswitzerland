import { Injectable, signal } from '@angular/core';
import { MapMarker } from '../map/map';
import { Attraction } from '../../models/attraction';

export function hasValidGeo(a: Attraction): boolean {
  const lat = Number(a.geo?.latitude);
  const lng = Number(a.geo?.longitude);
  return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
}

@Injectable({ providedIn: 'root' })
export class AttractionMarkersService {
  readonly markers = signal<MapMarker[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly attractionMap = signal<Map<string, Attraction>>(new Map());

  set(markers: MapMarker[], attractions: Attraction[]): void {
    this.markers.set(markers);
    this.attractionMap.set(new Map(attractions.map(a => [a.identifier, a])));
  }

  setSelected(id: string | null): void {
    this.selectedId.set(id);
  }

  clear(): void {
    this.markers.set([]);
    this.selectedId.set(null);
    this.attractionMap.set(new Map());
  }
}
