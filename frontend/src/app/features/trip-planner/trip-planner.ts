import {
  Component, DestroyRef, computed, effect, inject, signal, untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { SelectButton } from 'primeng/selectbutton';
import { AutoCompleteModule, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { DatePicker } from 'primeng/datepicker';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';
import { Divider } from 'primeng/divider';
import { Skeleton } from 'primeng/skeleton';
import { Tag } from 'primeng/tag';
import { Chip } from 'primeng/chip';
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

@Component({
  selector: 'app-trip-planner',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TranslatePipe,
    SelectButton, AutoCompleteModule, DatePicker, InputText,
    Button, Divider, Skeleton, Tag, Chip,
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
    { label: 'trip.planner.typeRoad', value: 'road', icon: 'fa-light fa-car-side' },
    { label: 'trip.planner.typeRail', value: 'rail', icon: 'fa-light fa-train' },
  ];
  selectedType = signal<'road' | 'rail'>('road');

  // ── Stops ─────────────────────────────────────────────────────────────────
  stops = signal<Array<TripStop | null>>([null, null]);
  stopSuggestions = signal<TripStop[][]>([[], []]);

  // ── Rail connections ──────────────────────────────────────────────────────
  connDate = signal<Date | null>(null);
  connTime = signal('');
  connections = signal<TripConnection[]>([]);
  selectedConnection = signal<TripConnection | null>(null);
  connectionsLoading = signal(false);
  today = new Date();

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

  readonly showConnections = computed(() =>
    this.selectedType() === 'rail' && this.validStops().length >= 2
  );

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
    this.stops.set(updated);
    this.plannerSvc.setStops(this.validStops());
    this.onStopsChanged();
  }

  onStopClear(index: number): void {
    const updated = [...this.stops()];
    updated[index] = null;
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
      this.plannerSvc.setRouteCoordinates([]);
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

    this.connectionsLoading.set(true);
    forkJoin({
      connections: this.transportSvc.getConnections(valid, dateStr, this.connTime()),
      journeys:    this.transportSvc.getConnectionJourneys(valid, dateStr, this.connTime()),
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ connections, journeys }) => {
          const merged = connections.map((conn, i) => ({
            ...conn,
            routeCoordinates: journeys[i]?.length >= 2 ? journeys[i] : conn.routeCoordinates,
          }));
          this.connections.set(merged);
          this.connectionsLoading.set(false);
        },
        error: () => this.connectionsLoading.set(false),
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
      attractionIds: [],
      routeCoordinates: this.plannerSvc.snapshot.routeCoordinates ?? [],
    };

    this.saving.set(true);
    this.tripsSvc.saveTrip(trip)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.messageSvc.add({ severity: 'success', summary: 'trip.planner.savedSuccess', life: 3000 });
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
