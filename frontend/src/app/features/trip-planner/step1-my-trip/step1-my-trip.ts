import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { TripPlannerService } from '../../../shared/services/trip-planner';
import { TripDateMode } from '../../../models/trip';
import { tripDayCount } from '../../../shared/utils/date-range';

interface SelectCardOption<T> {
  value: T;
  icon: string;
  titleKey: string;
  subtitleKey: string;
}

@Component({
  selector: 'app-step1-my-trip',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, Button, InputNumber],
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

  readonly startDate = computed(() => this.range().startDate ?? '');
  readonly endDate = computed(() => this.range().endDate ?? '');
  /** Trip length in days; startDay is always 1, so endDay IS the day count. */
  readonly numDays = computed(() => this.range().endDay ?? null);

  /** Inclusive day count — a trip from a date to itself is a valid 1-day trip. */
  readonly daysCount = computed(() => tripDayCount(this.range()));

  readonly canContinue = computed(() => this.daysCount() !== null);

  selectType(type: 'road' | 'rail'): void {
    if (type !== this.type()) this.plannerSvc.setType(type);
  }

  selectDateMode(mode: TripDateMode): void {
    if (mode !== this.dateMode()) this.plannerSvc.setDateMode(mode);
  }

  onStartDateChange(value: string): void {
    this.plannerSvc.setOverallRange({ ...this.range(), mode: 'dates', startDate: value || undefined });
  }

  onEndDateChange(value: string): void {
    this.plannerSvc.setOverallRange({ ...this.range(), mode: 'dates', endDate: value || undefined });
  }

  onNumDaysChange(value: number | null): void {
    if (value == null || value < 1) return;
    this.plannerSvc.setOverallRange({ mode: 'days', startDay: 1, endDay: value });
  }

  continue(): void {
    if (this.canContinue()) this.plannerSvc.nextStep();
  }
}
