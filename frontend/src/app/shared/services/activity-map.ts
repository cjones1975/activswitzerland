import { Injectable, inject } from '@angular/core';
import { Drawer } from './drawer';
import { AttractionMarkersService } from './attraction-markers';
import { HikeMarkersService } from './hike-markers';
import { BikeMarkersService } from './bike-markers';

export type ActivityMapCategory = 'attractions' | 'hikes' | 'bikes' | 'hotels';

/** Only one activity category's markers/reopen-button shows on the map at a time. */
@Injectable({ providedIn: 'root' })
export class ActivityMapService {
  private drawer = inject(Drawer);
  private attractionMarkers = inject(AttractionMarkersService);
  private hikeMarkers = inject(HikeMarkersService);
  private bikeMarkers = inject(BikeMarkersService);

  /** Pass `null` to clear every category — used when navigating to a new destination, before any category has been picked. */
  showOnly(active: ActivityMapCategory | null): void {
    if (active !== 'attractions') {
      this.drawer.close('all-attractions');
      this.drawer.close('attraction-detail');
      // Attraction markers are shown unconditionally once populated (no
      // drawer/selection gating) — the array itself must be wiped, not just
      // the selection, or the pins would keep rendering over hikes/bikes.
      this.attractionMarkers.set([], []);
      this.attractionMarkers.setSelected(null);
      this.attractionMarkers.setHasAttractions(false);
    }
    if (active !== 'hikes') {
      this.drawer.close('hikes');
      this.drawer.close('hike-detail');
      this.hikeMarkers.setSelected(null);
      this.hikeMarkers.setHasRoutes(false);
    }
    if (active !== 'bikes') {
      this.drawer.close('bikes');
      this.drawer.close('bike-detail');
      this.bikeMarkers.setSelected(null);
      this.bikeMarkers.setHasRoutes(false);
    }
  }
}
