import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Drawer } from '../../../shared/services/drawer';
import { Toast } from '../../../core/services/toast';
import { TripPlannerService } from '../../../shared/services/trip-planner';
import { ActivityKind, TripStop, TripActivitySelection, TripConnectionLeg } from '../../../models/trip';
import { stopDayRanges, tripDayCount, formatDdMmYyyy } from '../../../shared/utils/date-range';
import { StartOverLink } from '../start-over-link/start-over-link';

interface ActivityGroup { kind: ActivityKind; icon: string; labelKey: string; }

const ACTIVITY_GROUPS: ActivityGroup[] = [
  { kind: 'attraction', icon: '/assets/attraction.png', labelKey: 'trip.planner.step3.placesToVisit' },
  { kind: 'hike', icon: '/assets/hike.png', labelKey: 'trip.planner.step3.hikesNearby' },
  { kind: 'bike', icon: '/assets/bike.png', labelKey: 'trip.planner.step3.bikesNearby' },
];

@Component({
  selector: 'app-step4-summary',
  standalone: true,
  imports: [CommonModule, TranslatePipe, Button, StartOverLink],
  templateUrl: './step4-summary.html',
  styleUrl: './step4-summary.css',
})
export class Step4Summary {
  private drawerSvc = inject(Drawer);
  private toast = inject(Toast);
  private translate = inject(TranslateService);
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

  /** Every stop, including 0-day pass-throughs — a rail leg exists between every consecutive pair. */
  readonly timelineStops = computed(() => this.trip().stops);
  readonly stopDayLabels = computed(() => stopDayRanges(this.trip().stops));

  readonly unresolvedLegs = computed(() => {
    if (this.type() !== 'rail') return [];
    return this.plannerSvc.legPairs()
      .filter(pair => !this.plannerSvc.getConnectionLeg(pair.from.id, pair.to.id)?.connection);
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
    if (this.type() === 'rail' && !this.routeComplete()) {
      this.toast.warn(this.translate.instant('trip.planner.step4.mapRequiresConnections'), undefined, 3000, 'toast-warn');
      return;
    }
    this.plannerSvc.hideWizard();
  }

  legFor(fromStop: TripStop, toStop: TripStop): TripConnectionLeg | undefined {
    this.trip();
    return this.plannerSvc.getConnectionLeg(fromStop.id, toStop.id);
  }

  openConnection(fromStop: TripStop, toStop: TripStop): void {
    this.drawerSvc.open('connections', { focusLeg: `${fromStop.id}:${toStop.id}` });
  }

  formatTime(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso.slice(11, 16) : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  back(): void {
    this.plannerSvc.prevStep();
  }

  continue(): void {
    this.plannerSvc.nextStep();
  }
}
