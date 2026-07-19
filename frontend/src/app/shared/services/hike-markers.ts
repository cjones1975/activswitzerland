import { Injectable, signal } from '@angular/core';
import { MapMarker } from '../map/map';
import { TrailCategory, TrailRoute } from '../../models/trail-route';
import { GeoLocation } from '../../models/geo-point';

export type TrailCategoryFilter = TrailCategory | 'all';

@Injectable({ providedIn: 'root' })
export class HikeMarkersService {
  readonly markers = signal<MapMarker[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly routeMap = signal<Map<string, TrailRoute>>(new Map());
  readonly hasRoutes = signal(true);

  // List-view filter state lives here, not on the list component, so it
  // survives the component being destroyed/recreated as the drawer opens
  // and closes (PrimeNG tears down drawer content on hide), while still
  // resetting to defaults whenever a genuinely new destination is visited.
  readonly radiusKm = signal(10);
  readonly selectedCategory = signal<TrailCategoryFilter>('all');
  private lastDestination: GeoLocation | null = null;

  resetFiltersForDestination(dest: GeoLocation): void {
    if (dest === this.lastDestination) return;
    this.lastDestination = dest;
    this.radiusKm.set(10);
    this.selectedCategory.set('all');
  }

  set(routes: TrailRoute[]): void {
    const withStart = routes.filter(r => r.stages[0]?.geometryWgs84?.coordinates?.[0]?.length);
    this.markers.set(withStart.map(r => {
      const [lng, lat] = r.stages[0].geometryWgs84.coordinates[0][0];
      return {
        id: `hike-${r.routeNumber}`,
        lng,
        lat,
        label: r.name,
        image: '/assets/hike.png',
        className: 'hike-marker',
        clickable: true,
      };
    }));
    this.routeMap.set(new Map(withStart.map(r => [`hike-${r.routeNumber}`, r])));
  }

  setSelected(id: string | null): void {
    this.selectedId.set(id);
  }

  setHasRoutes(value: boolean): void {
    this.hasRoutes.set(value);
  }

  clear(): void {
    this.markers.set([]);
    this.selectedId.set(null);
    this.routeMap.set(new Map());
    this.hasRoutes.set(true);
  }
}
