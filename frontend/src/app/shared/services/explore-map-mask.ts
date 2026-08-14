import { Injectable, signal } from '@angular/core';

// Coordinates which Explore Trips card (if any) has its live-map mask open. Sibling TripCard
// instances have no other shared channel — same reason Drawer exists for drawer coordination.
// Simpler than Drawer since only one mask can ever be open: a single value, not a stack.
@Injectable({ providedIn: 'root' })
export class ExploreMapMask {
  private openTripId = signal<string | null>(null);

  isOpen(tripId: string): boolean {
    return this.openTripId() === tripId;
  }

  open(tripId: string): void {
    this.openTripId.set(tripId);
  }

  close(): void {
    this.openTripId.set(null);
  }
}
