import {
  Component, DestroyRef, computed, effect, inject, signal, untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { SelectButton } from 'primeng/selectbutton';
import { AutoCompleteModule, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { InputGroup } from 'primeng/inputgroup';
import { InputGroupAddon } from 'primeng/inputgroupaddon';
import { Button } from 'primeng/button';
import { Divider } from 'primeng/divider';
import { Skeleton } from 'primeng/skeleton';
import { Toast } from 'primeng/toast';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { FloatLabel } from 'primeng/floatlabel';
import { Message } from 'primeng/message';
import { MessageService, ConfirmationService } from 'primeng/api';
import { Drawer } from '../../shared/services/drawer';
import { TransportService } from '../../shared/services/transport';
import { TripPlannerService } from '../../shared/services/trip-planner';
import { TripsService } from '../../shared/services/trips';
import { Auth } from '../../core/services/auth';
import { TripStop, TripConnection, SavedTrip } from '../../models/trip';

type TripStep = 'stops' | 'schedule' | 'connection' | 'finish';

function swissNow(): Date {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Zurich',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parseInt(parts.find(p => p.type === t)!.value);
  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
}

@Component({
  selector: 'app-trip-planner',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslatePipe,
    DragDropModule,
    SelectButton, AutoCompleteModule, DatePicker, InputText, InputGroup, InputGroupAddon,
    Button, Divider, Skeleton,
    Toast, ConfirmDialog, FloatLabel, Message,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './trip-planner.html',
  styleUrl: './trip-planner.css',
})
export class TripPlanner {
  private drawerSvc    = inject(Drawer);
  private transportSvc = inject(TransportService);
  private plannerSvc   = inject(TripPlannerService);
  private tripsSvc     = inject(TripsService);
  private auth         = inject(Auth);
  private messageSvc   = inject(MessageService);
  private destroyRef   = inject(DestroyRef);

  // ── Trip type toggle ──────────────────────────────────────────────────────
  tripTypes = [
    { label: 'trip.planner.typeRoad', value: 'road', icon: 'fa-regular fa-car' },
    { label: 'trip.planner.typeRail', value: 'rail', icon: 'fa-regular fa-train' },
  ];
  selectedType = signal<'road' | 'rail'>('road');

  // ── Wizard steps ──────────────────────────────────────────────────────────
  step = signal(0);
  searchedConnections = signal(false);

  readonly steps = computed<TripStep[]>(() =>
    this.selectedType() === 'rail'
      ? ['stops', 'schedule', 'connection', 'finish']
      : ['stops', 'finish']
  );

  readonly currentStep = computed<TripStep>(() => this.steps()[this.step()]);

  // ── Stops ─────────────────────────────────────────────────────────────────
  stops = signal<Array<TripStop | null>>([null, null]);
  stopSuggestions = signal<TripStop[][]>([[], []]);
  isRoundTrip = signal(false);

  // ── Rail connections ──────────────────────────────────────────────────────
  connDate = signal<Date | null>(swissNow());
  connTime = signal<Date | null>(swissNow());
  connections = signal<TripConnection[]>([]);
  selectedConnection = signal<TripConnection | null>(null);
  connectionsLoading = signal(false);
  expandedConnectionIndex = signal<number | null>(null);
  today = swissNow();

  // ── Route ─────────────────────────────────────────────────────────────────
  routeLoading = signal(false);

  // ── Save ──────────────────────────────────────────────────────────────────
  tripName = signal('');
  saving = signal(false);

  readonly isLoggedIn = computed(() => this.auth.isLoggedIn());

  suggestedName = computed(() => {
    const filled = this.stops().filter((s): s is TripStop => s !== null);
    if (filled.length < 2) return '';
    if (filled.length === 2) return `${filled[0].name} → ${filled[filled.length - 1].name}`;
    return `${filled[0].name} → ${filled[1].name} → ${filled[filled.length - 1].name}`;
  });

  readonly validStops = computed(() =>
    this.stops().filter((s): s is TripStop => s !== null)
  );

  readonly canGoNext = computed(() => {
    switch (this.currentStep()) {
      case 'stops':      return this.validStops().length >= 2;
      case 'schedule':   return !this.connectionsLoading();
      case 'connection': return this.selectedConnection() !== null;
      default:           return false;
    }
  });

  readonly nextHint = computed<string | null>(() => {
    if (this.canGoNext()) return null;
    switch (this.currentStep()) {
      case 'stops':      return 'trip.planner.hints.selectStops';
      case 'connection': return 'trip.planner.hints.selectConnection';
      default:           return null;
    }
  });

  private readonly prefillName = computed(() => {
    this.drawerSvc.list();
    const payload = this.drawerSvc.getPayload<unknown>('trip-planner');
    return typeof payload === 'string' ? payload : null;
  });

  constructor() {
    const snapshot = this.plannerSvc.snapshot;
    if (snapshot.stops.length > 0) {
      this.selectedType.set(snapshot.type);
      this.stops.set([...snapshot.stops]);
      this.stopSuggestions.set(snapshot.stops.map(() => []));
      this.tripName.set(snapshot.name ?? '');
    }

    effect(() => {
      const name = this.prefillName();
      if (!name) return;
      untracked(() => {
        this.transportSvc.searchLocations(name, this.selectedType())
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(results => {
            const match = results[0];
            if (match) this.stops.set([null, match]);
          });
      });
    });
  }

  // ── Type toggle ───────────────────────────────────────────────────────────
  onTypeChange(type: 'road' | 'rail'): void {
    this.selectedType.set(type);
    this.plannerSvc.setType(type);
    this.stops.set([null, null]);
    this.stopSuggestions.set([[], []]);
    this.connections.set([]);
    this.selectedConnection.set(null);
    this.expandedConnectionIndex.set(null);
    this.step.set(0);
    this.searchedConnections.set(false);
    this.isRoundTrip.set(false);
  }

  // ── Round trip ────────────────────────────────────────────────────────────
  toggleRoundTrip(): void {
    const enabling = !this.isRoundTrip();
    this.isRoundTrip.set(enabling);
    if (enabling) {
      const updated = [...this.stops()];
      updated[updated.length - 1] = updated[0];
      this.stops.set(updated);
      this.plannerSvc.setStops(this.validStops());
      this.onStopsChanged();
    }
  }

  // ── Wizard navigation ────────────────────────────────────────────────────
  goNext(): void {
    if (!this.canGoNext()) return;
    if (this.currentStep() === 'schedule') {
      this.findConnections();
      return;
    }
    this.step.update(s => Math.min(s + 1, this.steps().length - 1));
  }

  goBack(): void {
    this.step.update(s => Math.max(s - 1, 0));
  }

  // ── Stop search ───────────────────────────────────────────────────────────
  searchStop(event: { query: string }, index: number): void {
    if (event.query.length < 3) return;
    this.transportSvc.searchLocations(event.query, this.selectedType())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(results => {
        const all = [...this.stopSuggestions()];
        all[index] = results;
        this.stopSuggestions.set(all);
      });
  }

  onStopSelect(event: AutoCompleteSelectEvent, index: number): void {
    const stop = event.value as TripStop;
    const updated = [...this.stops()];
    updated[index] = stop;
    if (this.isRoundTrip() && index === 0) {
      updated[updated.length - 1] = stop;
    }
    this.stops.set(updated);
    this.plannerSvc.setStops(this.validStops());
    this.onStopsChanged();
  }

  onStopClear(index: number): void {
    const updated = [...this.stops()];
    updated[index] = null;
    if (this.isRoundTrip() && index === 0) {
      updated[updated.length - 1] = null;
    }
    this.stops.set(updated);
    this.plannerSvc.setStops(this.validStops());
    this.plannerSvc.setRouteCoordinates([]);
  }

  addStop(): void {
    if (this.stops().length >= 8) return;
    const updated = [...this.stops()];
    updated.splice(updated.length - 1, 0, null);
    this.stops.set(updated);
    this.stopSuggestions.set([...this.stopSuggestions(), []]);
    this.plannerSvc.setStops(this.validStops());
  }

  removeStop(index: number): void {
    if (this.stops().length <= 2) return;
    const updated = this.stops().filter((_, i) => i !== index);
    this.stops.set(updated);
    const suggs = this.stopSuggestions().filter((_, i) => i !== index);
    this.stopSuggestions.set(suggs);
    this.plannerSvc.setStops(this.validStops());
    this.onStopsChanged();
  }

  reorderStop(event: CdkDragDrop<(TripStop | null)[]>): void {
    const n = this.stops().length;
    const from = event.previousIndex;
    const to = Math.max(1, Math.min(event.currentIndex, n - 2));
    if (from === to) return;
    const stops = [...this.stops()];
    const suggs = [...this.stopSuggestions()];
    moveItemInArray(stops, from, to);
    moveItemInArray(suggs, from, to);
    this.stops.set(stops);
    this.stopSuggestions.set(suggs);
    this.plannerSvc.setStops(this.validStops());
    this.onStopsChanged();
  }

  private onStopsChanged(): void {
    const valid = this.validStops();
    if (valid.length < 2) return;

    if (this.selectedType() === 'road') {
      this.routeLoading.set(true);
      this.plannerSvc.buildRoadRoute(valid)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(coords => {
          this.plannerSvc.setRouteCoordinates(coords);
          this.routeLoading.set(false);
        });
    } else {
      this.plannerSvc.setRouteCoordinates(this.plannerSvc.buildRailRoute(valid));
    }
  }

  // ── Rail connections ──────────────────────────────────────────────────────
  findConnections(): void {
    const valid = this.validStops();
    if (valid.length < 2) return;

    const date = this.connDate();
    const dateStr = date
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      : '';

    const time = this.connTime();
    const timeStr = time
      ? `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`
      : '';

    this.connectionsLoading.set(true);
    forkJoin({
      connections: this.transportSvc.getConnections(valid, dateStr, timeStr),
      journeys:    this.transportSvc.getConnectionJourneys(valid, dateStr, timeStr),
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ connections, journeys }) => {
          const merged = connections.map((conn, i) => ({
            ...conn,
            routeCoordinates: journeys[i]?.length >= 2 ? journeys[i] : conn.routeCoordinates,
          }));
          this.connections.set(merged);
          this.expandedConnectionIndex.set(null);
          this.connectionsLoading.set(false);
          this.searchedConnections.set(true);
          if (merged.length > 0) {
            this.step.update(s => Math.min(s + 1, this.steps().length - 1));
          }
        },
        error: () => {
          this.connectionsLoading.set(false);
          this.searchedConnections.set(true);
        },
      });
  }

  selectConnection(conn: TripConnection): void {
    this.selectedConnection.set(conn);
    this.plannerSvc.selectConnection(conn);
    if (conn.routeCoordinates.length >= 2) {
      this.plannerSvc.setRouteCoordinates(conn.routeCoordinates);
    }
  }

  formatTime(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso.slice(11, 16) : `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }

  formatDuration(raw: string): string {
    if (!raw) return '';
    const match = raw.match(/(\d+)d(\d+):(\d+)/);
    if (!match) return raw;
    const days = parseInt(match[1]), hrs = parseInt(match[2]), mins = parseInt(match[3]);
    const totalHrs = days * 24 + hrs;
    return totalHrs > 0 ? `${totalHrs}h ${mins}m` : `${mins}m`;
  }

  isSelectedConnection(conn: TripConnection): boolean {
    const sel = this.selectedConnection();
    return !!sel && sel.departure === conn.departure && sel.from === conn.from;
  }

  toggleDetail(index: number, event: Event): void {
    event.stopPropagation();
    this.expandedConnectionIndex.update(i => (i === index ? null : index));
  }

  formatPlatform(platform?: string): string {
    return platform ? `Pl. ${platform}` : '';
  }

  formatWalk(seconds?: number): string {
    if (!seconds || seconds < 60) return '';
    return `${Math.floor(seconds / 60)} min`;
  }

  firstTrainDeparture(conn: TripConnection): string {
    const first = conn.sections?.find(s => s.type === 'journey');
    return first?.departure?.time ?? conn.departure;
  }

  lastTrainArrival(conn: TripConnection): string {
    const journeys = conn.sections?.filter(s => s.type === 'journey') ?? [];
    const last = journeys[journeys.length - 1];
    return last?.arrival?.time ?? conn.arrival;
  }

  trainColor(category: string): string {
    const longDistance = ['IC', 'ICN', 'IR', 'EC', 'EN', 'TGV', 'RJX'];
    return longDistance.includes(category?.toUpperCase()) ? '#dc2626' : '#0079c3';
  }

  categoryLabel(category: string): string {
    const labels: Record<string, string> = {
      IC: 'Intercity', ICN: 'Intercity-Neigezug', IR: 'InterRegio',
      EC: 'EuroCity',  RE: 'RegioExpress',         S: 'S-Bahn',
    };
    return labels[category?.toUpperCase()] ?? category;
  }

  // ── Things to do ──────────────────────────────────────────────────────────
  openThingsToDo(stop: TripStop): void {
    this.drawerSvc.open('things-to-do', { stop });
  }

  // ── View trip on map ─────────────────────────────────────────────────────
  onViewTrip(): void {
    if (this.validStops().length < 2) return;
    this.drawerSvc.collapse('trip-planner');
  }

  selectionCount(stationId: string): number {
    return this.plannerSvc.getSelections(stationId).length;
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  onSave(): void {
    if (!this.isLoggedIn()) {
      this.drawerSvc.open('auth');
      return;
    }
    const valid = this.validStops();
    if (valid.length < 2) return;

    const name = this.tripName().trim() || this.suggestedName();
    const trip: SavedTrip = {
      name,
      type: this.selectedType(),
      stops: valid,
      attractionIds: this.plannerSvc.allSelectedAttractionIds(),
      routeCoordinates: this.plannerSvc.snapshot.routeCoordinates ?? [],
    };

    this.saving.set(true);
    this.tripsSvc.saveTrip(trip)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.messageSvc.add({ severity: 'success', summary: 'trip.planner.savedSuccess', life: 3000 });
          this.drawerSvc.collapse('trip-planner');
        },
        error: () => this.saving.set(false),
      });
  }

  onTripNameChange(name: string): void {
    this.tripName.set(name);
    this.plannerSvc.setName(name);
  }

  trackByIndex(index: number): number { return index; }
}
