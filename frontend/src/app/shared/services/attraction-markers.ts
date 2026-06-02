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

  set(markers: MapMarker[]): void {
    this.markers.set(markers);
  }

  clear(): void {
    this.markers.set([]);
  }
}
