import { Component, DestroyRef, computed, effect, inject, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { Drawer } from '../../../shared/services/drawer';
import { TransportService } from '../../../shared/services/transport';
import { TripPlannerService } from '../../../shared/services/trip-planner';
import { TripStop } from '../../../models/trip';
import { Step1MyTrip } from '../step1-my-trip/step1-my-trip';
import { Step2Itinerary } from '../step2-itinerary/step2-itinerary';
import { Step3Activities } from '../step3-activities/step3-activities';
import { Step4Summary } from '../step4-summary/step4-summary';

interface TripPlannerPrefill {
  name: string;
  lat: number;
  lon: number;
  identifier: string;
}

const STEP_KEYS = ['myTrip', 'itinerary', 'activities', 'summary', 'save'] as const;

@Component({
  selector: 'app-trip-planner-wizard',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ConfirmDialog, Step1MyTrip, Step2Itinerary, Step3Activities, Step4Summary],
  providers: [ConfirmationService],
  templateUrl: './trip-planner-wizard.html',
  styleUrl: './trip-planner-wizard.css',
})
export class TripPlannerWizard {
  private drawerSvc = inject(Drawer);
  private transportSvc = inject(TransportService);
  private confirmSvc = inject(ConfirmationService);
  private translate = inject(TranslateService);
  plannerSvc = inject(TripPlannerService);
  private destroyRef = inject(DestroyRef);

  readonly stepKeys = STEP_KEYS;

  readonly currentStepKey = computed(() => this.stepKeys[this.plannerSvc.step() - 1]);

  private readonly trip = toSignal(this.plannerSvc.trip$, { initialValue: this.plannerSvc.snapshot });
  readonly hasDraft = computed(() => this.trip().stops.length > 0);

  private readonly prefillPayload = computed(() => {
    this.drawerSvc.list();
    return this.drawerSvc.getPayload<string | TripPlannerPrefill>('trip-planner') ?? null;
  });

  constructor() {
    effect(() => {
      const payload = this.prefillPayload();
      if (!payload) return;
      untracked(() => this.applyPrefill(payload));
    });
  }

  stepLabelKey(key: string): string {
    return `trip.planner.steps.${key}`;
  }

  confirmStartOver(): void {
    this.confirmSvc.confirm({
      message: this.translate.instant('trip.planner.startOverConfirm'),
      header: this.translate.instant('trip.planner.startOver'),
      icon: 'fa-light fa-triangle-exclamation',
      acceptLabel: this.translate.instant('trip.planner.startOver'),
      rejectLabel: this.translate.instant('trip.planner.back'),
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.plannerSvc.reset(),
    });
  }

  private applyPrefill(payload: string | TripPlannerPrefill): void {
    const type = this.plannerSvc.snapshot.type;
    const existingDestination = this.plannerSvc.snapshot.stops.find(s => s.role === 'destination');

    if (typeof payload === 'object' && type === 'road') {
      const externalId = `dest:${payload.identifier}`;
      if (existingDestination?.externalId === externalId) return;
      this.plannerSvc.reset();
      this.plannerSvc.setStops([{
        id: crypto.randomUUID(),
        role: 'destination',
        name: payload.name,
        lat: payload.lat,
        lon: payload.lon,
        externalId,
        days: 1,
      }]);
      return;
    }

    const name = typeof payload === 'string' ? payload : payload.name;
    if (existingDestination?.name === name) return;
    this.plannerSvc.reset();
    if (type === 'rail') this.plannerSvc.setType('rail');

    this.transportSvc.searchLocations(name, type)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(results => {
        const match = results[0];
        if (!match) return;
        const destination: TripStop = {
          id: crypto.randomUUID(),
          role: 'destination',
          name: match.name,
          lat: match.lat,
          lon: match.lon,
          externalId: match.externalId,
          days: 1,
        };
        this.plannerSvc.setStops([destination]);
      });
  }
}
