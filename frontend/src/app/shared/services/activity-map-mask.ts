import { Injectable, signal } from '@angular/core';
import { MapMarker } from '../map/map';

/** Full-screen "view on map" overlay for contexts with no real page-map behind them (the trip
 * planner's activity picker, the AI chat drawer) — same minimal single-value-signal shape as
 * ExploreMapMask. Always shows the current attraction list's markers (AttractionMarkersService,
 * already populated by whichever list is open); `activeMarkerId`, when set, zooms/highlights that
 * one marker instead of fitting the whole list — used when opened from a specific attraction's
 * own detail view rather than the list itself. The mask stays deliberately dumb about *why* it's
 * open — callers supply `onReturn`/`onMarkerClick`, so the actual navigation logic lives exactly
 * once, wherever it already lived. */
export interface ActivityMapMaskState {
  /** Zoom/highlight this one marker instead of fitting every marker in view. */
  activeMarkerId?: string;
  returnIcon: string;
  returnLabelKey: string;
  onReturn: () => void;
  onMarkerClick: (marker: MapMarker) => void;
}

@Injectable({ providedIn: 'root' })
export class ActivityMapMask {
  readonly state = signal<ActivityMapMaskState | null>(null);

  open(state: ActivityMapMaskState): void {
    this.state.set(state);
  }

  close(): void {
    this.state.set(null);
  }
}
