import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { DatePicker } from 'primeng/datepicker';
import { TripPlannerService } from '../../../shared/services/trip-planner';
import { TripDateMode } from '../../../models/trip';
import { tripDayCount } from '../../../shared/utils/date-range';
import { StartOverLink } from '../start-over-link/start-over-link';

interface SelectCardOption<T> {
  value: T;
  icon: string;
  titleKey: string;
  subtitleKey: string;
}

@Component({
  selector: 'app-step1-my-trip',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, Button, InputNumber, DatePicker, StartOverLink],
  templateUrl: './step1-my-trip.html',
  styleUrl: './step1-my-trip.css',
})
export class Step1MyTrip {
  plannerSvc = inject(TripPlannerService);

  readonly tripTypes: SelectCardOption<'road' | 'rail'>[] = [
    { value: 'road', icon: 'fa-light fa-car', titleKey: 'trip.planner.step1.roadTitle', subtitleKey: 'trip.planner.step1.roadSubtitle' },
    { value: 'rail', icon: 'fa-light fa-train', titleKey: 'trip.planner.step1.railTitle', subtitleKey: 'trip.planner.step1.railSubtitle' },
  ];

  readonly dateModes: SelectCardOption<TripDateMode>[] = [
    { value: 'dates', icon: 'fa-light fa-calendar', titleKey: 'trip.planner.step1.datesTitle', subtitleKey: 'trip.planner.step1.datesSubtitle' },
    { value: 'days', icon: 'fa-light fa-hashtag', titleKey: 'trip.planner.step1.daysTitle', subtitleKey: 'trip.planner.step1.daysSubtitle' },
  ];

  private readonly trip = toSignal(this.plannerSvc.trip$, { initialValue: this.plannerSvc.snapshot });

  readonly type = computed(() => this.trip().type);
  readonly dateMode = computed(() => this.trip().dateMode);
  readonly range = computed(() => this.trip().range);

  readonly todayIso = new Date().toISOString().slice(0, 10);
  readonly minDate = new Date();

  readonly startDate = computed(() => this.range().startDate ?? '');
  readonly endDate = computed(() => this.range().endDate ?? '');

  /**
   * Local source of truth for the picker's own value. Deliberately NOT a `computed()` off
   * the service — re-deriving a fresh Date[] on every service update and feeding it back via
   * [ngModel] resets the calendar's in-progress range selection after the first click, making
   * it impossible to pick a second date. The sync effect below only overwrites this when the
   * service's iso values actually diverge from what's already here (e.g. external reset).
   *
   * Must be `null` (not `[null, null]`) when empty — PrimeNG's range selectDate() treats any
   * truthy, length-2 value as "start already picked" and calls `.getTime()` on `value[0]`,
   * throwing if that's null and silently breaking the first click.
   */
  readonly dateRangeValue = signal<(Date | null)[] | null>(
    this.computeRangeValue(this.plannerSvc.snapshot.range.startDate, this.plannerSvc.snapshot.range.endDate)
  );

  /** Trip length in days; startDay is always 1, so endDay IS the day count. */
  readonly numDays = computed(() => this.range().endDay ?? null);

  /** Inclusive day count — a trip from a date to itself is a valid 1-day trip. */
  readonly daysCount = computed(() => tripDayCount(this.range()));

  readonly canContinue = computed(() => this.daysCount() !== null);

  constructor() {
    effect(() => {
      const startIso = this.startDate();
      const endIso = this.endDate();
      const [curStart, curEnd] = this.dateRangeValue() ?? [null, null];
      if (startIso !== (this.formatIsoDate(curStart) ?? '') || endIso !== (this.formatIsoDate(curEnd) ?? '')) {
        this.dateRangeValue.set(this.computeRangeValue(startIso, endIso));
      }
    });
  }

  selectType(type: 'road' | 'rail'): void {
    if (type !== this.type()) this.plannerSvc.setType(type);
  }

  selectDateMode(mode: TripDateMode): void {
    if (mode !== this.dateMode()) this.plannerSvc.setDateMode(mode);
  }

  onDateRangeChange(value: (Date | null)[] | null): void {
    const [start, end] = value ?? [null, null];
    this.dateRangeValue.set(value);
    this.plannerSvc.setOverallRange({
      ...this.range(),
      mode: 'dates',
      startDate: this.formatIsoDate(start) ?? undefined,
      endDate: this.formatIsoDate(end) ?? undefined,
    });
  }

  /** `null` (not `[start, null]`) when there's no start date, matching what PrimeNG's range picker expects for "empty". */
  private computeRangeValue(startIso: string | undefined, endIso: string | undefined): (Date | null)[] | null {
    const start = this.parseIsoDate(startIso ?? '');
    if (!start) return null;
    return [start, this.parseIsoDate(endIso ?? '')];
  }

  /** Local-time parse; avoids the UTC shift `new Date(iso)` would introduce for date-only strings. */
  private parseIsoDate(iso: string): Date | null {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  private formatIsoDate(date: Date | null | undefined): string | null {
    if (!date) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  onNumDaysChange(value: number | null): void {
    if (value == null || value < 1) return;
    this.plannerSvc.setOverallRange({ mode: 'days', startDay: 1, endDay: value });
  }

  continue(): void {
    if (this.canContinue()) this.plannerSvc.nextStep();
  }
}
