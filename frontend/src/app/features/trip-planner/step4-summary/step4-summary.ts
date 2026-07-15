import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Drawer } from '../../../shared/services/drawer';
import { TripPlannerService } from '../../../shared/services/trip-planner';
import { ActivityKind, TripStop, TripActivitySelection } from '../../../models/trip';
import { stopDayRanges, tripDayCount, formatDdMmYyyy } from '../../../shared/utils/date-range';

interface ActivityGroup { kind: ActivityKind; icon: string; labelKey: string; }

const ACTIVITY_GROUPS: ActivityGroup[] = [
  { kind: 'attraction', icon: 'fa-solid fa-binoculars', labelKey: 'trip.planner.step3.placesToVisit' },
  { kind: 'hike', icon: 'fa-solid fa-person-hiking', labelKey: 'trip.planner.step3.hikesNearby' },
  { kind: 'bike', icon: 'fa-solid fa-bicycle', labelKey: 'trip.planner.step3.bikesNearby' },
];

@Component({
  selector: 'app-step4-summary',
  standalone: true,
  imports: [CommonModule, TranslatePipe, Button],
  templateUrl: './step4-summary.html',
  styleUrl: './step4-summary.css',
})
export class Step4Summary {
  private drawerSvc = inject(Drawer);
  plannerSvc = inject(TripPlannerService);

  private readonly trip = toSignal(this.plannerSvc.trip$, { initialValue: this.plannerSvc.snapshot });

  readonly groups = ACTIVITY_GROUPS;

  readonly type = computed(() => this.trip().type);
  readonly dateMode = computed(() => this.trip().dateMode);
  readonly dayCount = computed(() => tripDayCount(this.trip().range));
  readonly formattedDateRange = computed(() => {
    const range = this.trip().range;
    return range.startDate && range.endDate
      ? `${formatDdMmYyyy(range.startDate)} — ${formatDdMmYyyy(range.endDate)}`
      : null;
  });

  readonly destinationCount = computed(() => this.trip().stops.length);
  readonly activityCount = computed(() => this.trip().activities.length);

  readonly visibleStops = computed(() => this.trip().stops.filter(s => s.days > 0));
  readonly stopDayLabels = computed(() => stopDayRanges(this.trip().stops));

  readonly unresolvedLegs = computed(() => {
    const stops = this.trip().stops;
    if (this.type() !== 'rail') return [];
    const legs: { from: TripStop; to: TripStop }[] = [];
    for (let i = 0; i < stops.length - 1; i++) {
      const leg = this.plannerSvc.getConnectionLeg(stops[i].id, stops[i + 1].id);
      if (!leg?.connection) legs.push({ from: stops[i], to: stops[i + 1] });
    }
    return legs;
  });

  readonly routeComplete = computed(() =>
    this.trip().stops.length >= 2 && this.unresolvedLegs().length === 0
  );

  readonly routeSummary = computed(() => {
    const stops = this.trip().stops;
    return stops.length >= 2 ? `${stops[0].name} → ${stops[stops.length - 1].name}` : '';
  });

  activitiesFor(stop: TripStop, kind: ActivityKind): TripActivitySelection[] {
    this.trip();
    return this.plannerSvc.getActivitiesForStop(stop.id).filter(a => a.kind === kind);
  }

  hasActivities(stop: TripStop): boolean {
    this.trip();
    return this.plannerSvc.getActivitiesForStop(stop.id).length > 0;
  }

  removeActivity(activity: TripActivitySelection): void {
    this.plannerSvc.removeActivity(activity.id);
  }

  showMap(): void {
    this.drawerSvc.collapse('trip-planner');
  }

  fixConnection(): void {
    this.plannerSvc.step.set(2);
  }

  back(): void {
    this.plannerSvc.prevStep();
  }

  continue(): void {
    this.plannerSvc.nextStep();
  }
}
