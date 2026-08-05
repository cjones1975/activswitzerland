import { Component, Input, computed } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Timeline } from 'primeng/timeline';
import { PublicTrip, TripStop, ActivityKind, TripActivitySelection } from '../../../models/trip';
import { stopDayRanges, formatDdMmYyyy } from '../../../shared/utils/date-range';
import { ACTIVITY_GROUPS } from '../../trip-planner/step4-summary/step4-summary';

@Component({
  selector: 'app-trip-timeline',
  standalone: true,
  imports: [TranslatePipe, Timeline],
  templateUrl: './trip-timeline.html',
  styleUrl: './trip-timeline.css',
})
export class TripTimeline {
  @Input({ required: true }) trip!: PublicTrip;

  readonly groups = ACTIVITY_GROUPS;

  readonly dayRanges = computed(() => stopDayRanges(this.trip.stops));

  dayRangeFor(stop: TripStop): { start: number; end: number } | undefined {
    return this.dayRanges().get(stop.id);
  }

  /** Calendar start/end for the stop's day span, only meaningful in 'dates' mode — mirrors the
   * per-day conversion `stopDayOptions()` does, aggregated to the stop's whole range. */
  dateRangeFor(stop: TripStop): { startDate?: string; endDate?: string } {
    if (this.trip.dateMode !== 'dates' || !this.trip.range.startDate) return {};
    const range = this.dayRangeFor(stop);
    if (!range) return {};
    const base = Date.parse(this.trip.range.startDate);
    const startDate = new Date(base + (range.start - 1) * 86400000).toISOString().slice(0, 10);
    const endDate = new Date(base + (range.end - 1) * 86400000).toISOString().slice(0, 10);
    return { startDate, endDate };
  }

  formatDdMmYyyy = formatDdMmYyyy;

  /** Day labels ("Day N") are redundant once a real calendar date is shown — only relevant when
   * the trip was built in 'days' mode, which has no calendar date to show instead. */
  readonly isDatesMode = computed(() => this.trip.dateMode === 'dates');

  isTransit(stop: TripStop): boolean {
    return stop.days === 0;
  }

  hasActivities(stop: TripStop): boolean {
    return this.trip.activities.some(a => a.stopId === stop.id);
  }

  activitiesFor(stop: TripStop, kind: ActivityKind): TripActivitySelection[] {
    return this.trip.activities.filter(a => a.stopId === stop.id && a.kind === kind);
  }
}
