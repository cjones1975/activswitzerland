import { Component, DestroyRef, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { AutoCompleteModule, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { TripPlannerService } from '../../../shared/services/trip-planner';
import { TransportService, LocationSearchResult } from '../../../shared/services/transport';
import { TripStop, TripDateRange } from '../../../models/trip';
import { tripDayCount, stopDayRanges } from '../../../shared/utils/date-range';
import { ConnectionLegPicker } from './connection-leg-picker/connection-leg-picker';

const MAX_VIA_STOPS = 6;
const DEFAULT_STOP_DAYS = 1;

@Component({
  selector: 'app-step2-itinerary',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, DragDropModule, AutoCompleteModule, Button, Message, ConnectionLegPicker],
  templateUrl: './step2-itinerary.html',
  styleUrl: './step2-itinerary.css',
})
export class Step2Itinerary {
  private plannerSvc = inject(TripPlannerService);
  private transportSvc = inject(TransportService);
  private destroyRef = inject(DestroyRef);

  private readonly trip = toSignal(this.plannerSvc.trip$, { initialValue: this.plannerSvc.snapshot });

  readonly type = computed(() => this.trip().type);
  readonly overallRange = computed(() => this.trip().range);

  readonly totalTripDays = computed(() => tripDayCount(this.overallRange()));
  readonly allocatedDays = computed(() => this.trip().stops.reduce((sum, s) => sum + (s.days ?? 0), 0));
  readonly remainingDays = computed(() => {
    const total = this.totalTripDays();
    return total == null ? null : total - this.allocatedDays();
  });
  readonly allocationMessage = computed(() => {
    const remaining = this.remainingDays();
    if (remaining == null || remaining === 0 || this.trip().stops.length < 2) return null;
    const count = Math.abs(remaining);
    const key = remaining > 0
      ? (count === 1 ? 'trip.planner.step2.dayRemaining' : 'trip.planner.step2.daysRemaining')
      : (count === 1 ? 'trip.planner.step2.dayOverBudget' : 'trip.planner.step2.daysOverBudget');
    return { key, count };
  });

  /** "Day N" / "Days N–M" per stop — see `stopDayRanges()` for the accumulation rule. */
  readonly stopDayLabels = computed(() => stopDayRanges(this.trip().stops));

  private readonly initial = this.buildInitialSlots();
  readonly departure = signal<TripStop | null>(this.initial.departure);
  readonly destination = signal<TripStop | null>(this.initial.destination);
  readonly viaStops = signal<TripStop[]>(this.initial.via);

  readonly addingStop = signal(false);
  readonly canAddStop = computed(() => this.viaStops().length < MAX_VIA_STOPS);

  readonly departureSuggestions = signal<LocationSearchResult[]>([]);
  readonly destinationSuggestions = signal<LocationSearchResult[]>([]);
  readonly viaSuggestions = signal<LocationSearchResult[]>([]);
  readonly addStopSuggestions = signal<LocationSearchResult[]>([]);

  readonly routeLoading = signal(false);
  readonly routeError = signal(false);
  readonly routeUnreachable = signal(false);

  readonly legPairs = computed(() => {
    const stops = this.trip().stops;
    const pairs: { from: TripStop; to: TripStop }[] = [];
    for (let i = 0; i < stops.length - 1; i++) pairs.push({ from: stops[i], to: stops[i + 1] });
    return pairs;
  });

  readonly canContinue = computed(() =>
    this.departure() !== null && this.destination() !== null && !this.routeUnreachable() && this.allocationMessage() === null
  );

  constructor() {
    if (this.departure() && this.destination()) this.syncStops();
  }

  private buildInitialSlots(): { departure: TripStop | null; destination: TripStop | null; via: TripStop[] } {
    const stops = this.plannerSvc.snapshot.stops;
    if (stops.length === 0) return { departure: null, destination: null, via: [] };
    if (stops.length === 1) {
      const only = stops[0];
      return only.role === 'destination'
        ? { departure: null, destination: only, via: [] }
        : { departure: only, destination: null, via: [] };
    }
    return { departure: stops[0], destination: stops[stops.length - 1], via: stops.slice(1, -1) };
  }

  // ── Search ────────────────────────────────────────────────────────────
  private search(event: { query: string }, target: WritableSignal<LocationSearchResult[]>): void {
    if (event.query.length < 3) return;
    this.transportSvc.searchLocations(event.query, this.type())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(results => target.set(results));
  }

  searchDeparture(event: { query: string }): void { this.search(event, this.departureSuggestions); }
  searchDestination(event: { query: string }): void { this.search(event, this.destinationSuggestions); }
  searchVia(event: { query: string }): void { this.search(event, this.viaSuggestions); }
  searchAddStop(event: { query: string }): void { this.search(event, this.addStopSuggestions); }

  onDepartureSelect(event: AutoCompleteSelectEvent): void {
    const result = event.value as LocationSearchResult;
    const existing = this.departure();
    this.departure.set({
      id: existing?.id ?? crypto.randomUUID(),
      role: 'departure',
      name: result.name, lat: result.lat, lon: result.lon, externalId: result.externalId,
      days: existing?.days ?? DEFAULT_STOP_DAYS,
    });
    this.syncStops();
  }

  onDestinationSelect(event: AutoCompleteSelectEvent): void {
    const result = event.value as LocationSearchResult;
    const existing = this.destination();
    this.destination.set({
      id: existing?.id ?? crypto.randomUUID(),
      role: 'destination',
      name: result.name, lat: result.lat, lon: result.lon, externalId: result.externalId,
      days: existing?.days ?? DEFAULT_STOP_DAYS,
    });
    this.syncStops();
  }

  onViaSelect(event: AutoCompleteSelectEvent, stop: TripStop): void {
    const result = event.value as LocationSearchResult;
    const updated: TripStop = { ...stop, name: result.name, lat: result.lat, lon: result.lon, externalId: result.externalId };
    this.viaStops.update(v => v.map(s => s.id === stop.id ? updated : s));
    this.syncStops();
  }

  startAddStop(): void { this.addingStop.set(true); }
  cancelAddStop(): void { this.addingStop.set(false); this.addStopSuggestions.set([]); }

  onAddStopSelect(event: AutoCompleteSelectEvent): void {
    const result = event.value as LocationSearchResult;
    const stop: TripStop = {
      id: crypto.randomUUID(),
      role: 'stop',
      name: result.name, lat: result.lat, lon: result.lon, externalId: result.externalId,
      days: DEFAULT_STOP_DAYS,
    };
    this.viaStops.update(v => [...v, stop]);
    this.addingStop.set(false);
    this.addStopSuggestions.set([]);
    this.syncStops();
  }

  removeVia(id: string): void {
    this.viaStops.update(v => v.filter(s => s.id !== id));
    this.syncStops();
  }

  reorderVia(event: CdkDragDrop<TripStop[]>): void {
    const vias = [...this.viaStops()];
    moveItemInArray(vias, event.previousIndex, event.currentIndex);
    this.viaStops.set(vias);
    this.syncStops();
  }

  // ── Days ──────────────────────────────────────────────────────────────
  /** Days here is owned by the service (`updateStopDays`), not the local departure/via/destination draft — always read the live value so the field can't display a stale copy. */
  daysFor(stop: TripStop): number {
    return this.trip().stops.find(s => s.id === stop.id)?.days ?? stop.days;
  }

  onDaysChange(stop: TripStop, value: number | null): void {
    if (value == null || value < 0) return;
    this.plannerSvc.updateStopDays(stop.id, value);
  }

  rangeLabel(range: TripDateRange): string {
    if (range.mode === 'dates') {
      return range.startDate && range.endDate ? `${range.startDate} — ${range.endDate}` : '';
    }
    return range.startDay != null && range.endDay != null ? `Day ${range.startDay} – ${range.endDay}` : '';
  }

  // ── Sync + route ──────────────────────────────────────────────────────
  /**
   * Rebuilds the service's stop list from the local identity/order draft (departure/via/destination).
   * `days` isn't part of that draft — it's edited directly against the service via `updateStopDays` — so
   * each stop's current live days is preserved here rather than overwritten with a stale draft copy.
   */
  private syncStops(): void {
    const currentDays = new Map(this.trip().stops.map(s => [s.id, s.days]));
    const list = [this.departure(), ...this.viaStops(), this.destination()]
      .filter((s): s is TripStop => s !== null)
      .map(s => ({ ...s, days: currentDays.get(s.id) ?? s.days }));
    this.plannerSvc.setStops(list);
    this.rebuildRoute();
  }

  onLegResolved(): void {
    this.rebuildRoute();
  }

  private rebuildRoute(): void {
    const stops = this.plannerSvc.snapshot.stops;
    if (stops.length < 2) {
      this.plannerSvc.setRouteCoordinates([]);
      return;
    }
    if (this.type() === 'road') {
      this.routeLoading.set(true);
      this.routeError.set(false);
      this.routeUnreachable.set(false);
      this.plannerSvc.buildRoadRoute(stops)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: coords => {
            this.plannerSvc.setRouteCoordinates(coords);
            this.routeLoading.set(false);
          },
          error: err => {
            this.plannerSvc.setRouteCoordinates([]);
            this.routeLoading.set(false);
            if (err instanceof Error && err.message === 'NO_ROAD_ROUTE') this.routeUnreachable.set(true);
            else this.routeError.set(true);
          },
        });
    } else {
      this.plannerSvc.setRouteCoordinates(this.plannerSvc.buildRailRoute(stops));
    }
  }

  back(): void {
    this.plannerSvc.prevStep();
  }

  next(): void {
    this.plannerSvc.nextStep();
  }
}
