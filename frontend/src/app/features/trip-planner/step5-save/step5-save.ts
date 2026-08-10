import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Drawer } from '../../../shared/services/drawer';
import { Toast } from '../../../core/services/toast';
import { Auth } from '../../../core/services/auth';
import { TripPlannerService } from '../../../shared/services/trip-planner';
import { TripsService } from '../../../shared/services/trips';
import { SavedTrip } from '../../../models/trip';
import { tripDayCount, formatDdMmYyyy } from '../../../shared/utils/date-range';
import { StartOverLink } from '../start-over-link/start-over-link';

@Component({
  selector: 'app-step5-save',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, Button, InputText, ToggleSwitch, StartOverLink],
  templateUrl: './step5-save.html',
  styleUrl: './step5-save.css',
})
export class Step5Save {
  private drawerSvc = inject(Drawer);
  private toast = inject(Toast);
  private translate = inject(TranslateService);
  private tripsSvc = inject(TripsService);
  plannerSvc = inject(TripPlannerService);
  auth = inject(Auth);

  private readonly trip = toSignal(this.plannerSvc.trip$, { initialValue: this.plannerSvc.snapshot });

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

  readonly isEditing = computed(() => this.plannerSvc.loadedTripId() !== null);

  readonly name = signal(this.initialName());
  readonly isPublic = signal(this.plannerSvc.snapshot.isPublic ?? false);
  readonly anonymous = signal(this.plannerSvc.snapshot.anonymous ?? true);
  readonly saving = signal(false);

  private initialName(): string {
    const existing = this.plannerSvc.snapshot.name;
    if (existing) return existing;
    const key = this.plannerSvc.snapshot.type === 'rail'
      ? 'trip.planner.step5.suggestedRail'
      : 'trip.planner.step5.suggestedRoad';
    return this.translate.instant(key);
  }

  setName(value: string): void {
    this.name.set(value);
  }

  save(): void {
    if (!this.auth.isLoggedIn()) {
      this.drawerSvc.open('auth');
      return;
    }
    const name = this.name().trim();
    if (!name) return;

    this.saving.set(true);
    const payload: SavedTrip = { ...this.plannerSvc.snapshot, name, isPublic: this.isPublic(), anonymous: this.anonymous() };
    const id = this.plannerSvc.loadedTripId();
    const req$ = id ? this.tripsSvc.updateTrip(id, payload) : this.tripsSvc.saveTrip(payload);

    req$.subscribe({
      next: saved => {
        this.saving.set(false);
        if (saved._id) this.plannerSvc.loadedTripId.set(saved._id);
        this.plannerSvc.clearDraft();
        this.toast.success(this.translate.instant('trip.planner.savedSuccess'), undefined, 3000, 'toast-error');
        this.plannerSvc.hideWizard();
      },
      error: () => {
        this.saving.set(false);
        this.toast.error(this.translate.instant('trip.planner.step5.saveError'), undefined, 3000, 'toast-error');
      },
    });
  }

  back(): void {
    this.plannerSvc.prevStep();
  }
}
