import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Drawer } from '../../../shared/services/drawer';
import { TripPlannerService } from '../../../shared/services/trip-planner';
import { tripDayCount, formatDdMmYyyy } from '../../../shared/utils/date-range';
import { ConnectionLegPicker } from '../step2-itinerary/connection-leg-picker/connection-leg-picker';

@Component({
  selector: 'app-connections-drawer',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ConnectionLegPicker],
  templateUrl: './connections-drawer.html',
  styleUrl: './connections-drawer.css',
})
export class ConnectionsDrawer {
  private drawerSvc = inject(Drawer);
  plannerSvc = inject(TripPlannerService);

  private readonly trip = toSignal(this.plannerSvc.trip$, { initialValue: this.plannerSvc.snapshot });

  readonly dateMode = computed(() => this.trip().dateMode);
  readonly dayCount = computed(() => tripDayCount(this.trip().range));
  readonly formattedDateRange = computed(() => {
    const range = this.trip().range;
    return range.startDate && range.endDate
      ? `${formatDdMmYyyy(range.startDate)} — ${formatDdMmYyyy(range.endDate)}`
      : null;
  });

  /** Which leg (if any) to auto-expand — set when opened from a Summary timeline click. */
  isFocused(fromStopId: string, toStopId: string): boolean {
    return this.drawerSvc.getPayload<{ focusLeg?: string }>('connections')?.focusLeg === `${fromStopId}:${toStopId}`;
  }

  /** Rail-only, so a straight leg-by-leg stitch is always the right route rebuild here (unlike Step 2, which also handles road-route fetching). */
  onLegResolved(): void {
    const stops = this.plannerSvc.snapshot.stops;
    if (stops.length >= 2) {
      this.plannerSvc.setRouteCoordinates(this.plannerSvc.buildRailRoute(stops));
    }
  }
}
