import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ActivityMapMask as ActivityMapMaskService } from '../services/activity-map-mask';
import { AttractionMarkersService } from '../services/attraction-markers';
import { MapComponent, MapMarker } from '../map/map';

@Component({
  selector: 'app-activity-map-mask',
  standalone: true,
  imports: [TranslatePipe, MapComponent],
  templateUrl: './activity-map-mask.html',
  styleUrl: './activity-map-mask.css',
})
export class ActivityMapMaskOverlay {
  mask = inject(ActivityMapMaskService);
  private attractionMarkers = inject(AttractionMarkersService);

  private activeMarker = computed<MapMarker | null>(() => {
    const id = this.mask.state()?.activeMarkerId;
    if (!id) return null;
    return this.attractionMarkers.markers().find(m => m.id === id) ?? null;
  });

  // The active marker (if any) opens its popup immediately, so it reads as "this is the one you
  // were viewing" without depending on MapComponent's activeMarker Input (which only re-flies on
  // a *change*, not on the mask's first render — openByDefault avoids that lifecycle gap).
  markers = computed<MapMarker[]>(() => {
    if (!this.mask.state()) return [];
    const active = this.activeMarker();
    const all = this.attractionMarkers.markers();
    return active ? all.map(m => (m.id === active.id ? { ...m, openByDefault: true, highlight: true } : m)) : all;
  });

  center = computed<[number, number] | undefined>(() => {
    const active = this.activeMarker();
    return active ? [active.lng, active.lat] : undefined;
  });

  zoom = computed<number>(() => (this.activeMarker() ? 14 : 12));

  fitBounds = computed<[number, number][] | null>(() => {
    if (this.activeMarker()) return null; // center + zoom above handles this case instead
    const points = this.markers().map(m => [m.lng, m.lat] as [number, number]);
    return points.length >= 2 ? points : null;
  });

  onMarkerClick(marker: MapMarker): void {
    this.mask.state()?.onMarkerClick(marker);
  }

  onReturn(): void {
    this.mask.state()?.onReturn();
    this.mask.close();
  }
}
