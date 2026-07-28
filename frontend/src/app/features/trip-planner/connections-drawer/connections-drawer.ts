import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { TripPlannerService } from '../../../shared/services/trip-planner';
import { ConnectionLegPicker } from '../step2-itinerary/connection-leg-picker/connection-leg-picker';

@Component({
  selector: 'app-connections-drawer',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ConnectionLegPicker],
  templateUrl: './connections-drawer.html',
  styleUrl: './connections-drawer.css',
})
export class ConnectionsDrawer {
  plannerSvc = inject(TripPlannerService);

  /** Rail-only, so a straight leg-by-leg stitch is always the right route rebuild here (unlike Step 2, which also handles road-route fetching). */
  onLegResolved(): void {
    const stops = this.plannerSvc.snapshot.stops;
    if (stops.length >= 2) {
      this.plannerSvc.setRouteCoordinates(this.plannerSvc.buildRailRoute(stops));
    }
  }
}
