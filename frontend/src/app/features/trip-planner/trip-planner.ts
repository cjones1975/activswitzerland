import {
  Component, DestroyRef, OnInit, computed, inject, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { AttractionsService } from '../../shared/services/attractions';
import { LangService } from '../../shared/services/lang';
import { Auth } from '../../core/services/auth';
import { TripStop, TripConnection, SavedTrip } from '../../models/trip';
import { Attraction } from '../../models/attraction';

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
export class TripPlanner implements OnInit {
  private drawerSvc       = inject(Drawer);
  private transportSvc    = inject(TransportService);
  private plannerSvc      = inject(TripPlannerService);
  private tripsSvc        = inject(TripsService);
  private attractionsSvc  = inject(AttractionsService);
  private langSvc         = inject(LangService);
  private auth            = inject(Auth);
  private messageSvc      = inject(MessageService);
  private destroyRef      = inject(DestroyRef);

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

  // ── Attractions ───────────────────────────────────────────────────────────
  attractions = signal<Attraction[]>([]);
  attractionsLoading = signal(false);

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

  readonly showAttractions = computed(() =>
    this.plannerSvc.snapshot.routeCoordinates?.length ?? 0 > 0
  );

  ngOnInit(): void {
    // Pre-fill first stop from drawer payload (e.g. opened from destination-detail)
    const payload = this.drawerSvc.getPayload<TripStop>('trip-planner');
    if (payload?.stationId) {
      const stops = [payload, null] as Array<TripStop | null>;
      this.stops.set(stops);
      this.stopSuggestions.set([[], []]);
    }
  }

  // ── Type toggle ───────────────────────────────────────────────────────────
  onTypeChange(type: 'road' | 'rail'): void {
    this.selectedType.set(type);
    this.plannerSvc.setType(type);
    this.stops.set([null, null]);
    this.stopSuggestions.set([[], []]);
    this.connections.set([]);
    this.selectedConnection.set(null);
    this.attractions.set([]);
  }

  // ── Stop search ───────────────────────────────────────────────────────────
  searchStop(event: { query: string }, index: number): void {
    if (event.query.length < 3) return;
    this.transportSvc.searchLocations(event.query)
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
    this.onStopsChanged();
  }

  onStopClear(index: number): void {
    const updated = [...this.stops()];
    updated[index] = null;
    this.stops.set(updated);
    this.plannerSvc.setRouteCoordinates([]);
    this.attractions.set([]);
  }

  addStop(): void {
    if (this.stops().length >= 8) return;
    const updated = [...this.stops()];
    updated.splice(updated.length - 1, 0, null);
    this.stops.set(updated);
    this.stopSuggestions.set([...this.stopSuggestions(), []]);
  }

  removeStop(index: number): void {
    if (this.stops().length <= 2) return;
    const updated = this.stops().filter((_, i) => i !== index);
    this.stops.set(updated);
    const suggs = this.stopSuggestions().filter((_, i) => i !== index);
    this.stopSuggestions.set(suggs);
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
          this.loadAttractions(valid);
        });
    } else {
      // Rail: draw straight line immediately, let user find connections separately
      const coords = this.plannerSvc.buildRailRoute(valid);
      this.plannerSvc.setRouteCoordinates(coords);
      this.loadAttractions(valid);
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
    this.transportSvc.getConnections(valid, dateStr, this.connTime())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: conns => {
          this.connections.set(conns);
          this.connectionsLoading.set(false);
        },
        error: () => this.connectionsLoading.set(false),
      });
  }

  selectConnection(conn: TripConnection): void {
    this.selectedConnection.set(conn);
    this.plannerSvc.selectConnection(conn);
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

  // ── Attractions ───────────────────────────────────────────────────────────
  private loadAttractions(stops: TripStop[]): void {
    this.attractionsLoading.set(true);
    const lang = this.langSvc.current;
    const seen = new Set<string>();
    const all: Attraction[] = [];
    let pending = stops.length;

    stops.forEach(stop => {
      this.attractionsSvc.searchAttractions({
        language: lang,
        page: 0,
        search: '',
        hitsPerPage: 6,
        placeId: '',
        expand: false,
        translate: true,
        stripHtml: false,
        top: true,
      }).pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: page => {
            page.attractions.forEach(a => {
              if (!seen.has(a.identifier) && a.geo?.latitude && a.geo?.longitude) {
                const dist = this.haversine(stop.lat, stop.lon, a.geo.latitude, a.geo.longitude);
                if (dist <= 10000) {
                  seen.add(a.identifier);
                  all.push(a);
                }
              }
            });
            pending--;
            if (pending === 0) {
              this.attractions.set(all);
              this.plannerSvc.setAttractions(all);
              this.attractionsLoading.set(false);
            }
          },
          error: () => {
            pending--;
            if (pending === 0) this.attractionsLoading.set(false);
          },
        });
    });
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  openAttraction(attraction: Attraction): void {
    this.drawerSvc.open('attraction-detail', { attraction, source: 'trip-planner' });
  }

  getAttractionTag(a: Attraction): string {
    return a.classification?.[0]?.values?.[0]?.title ?? '';
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
      attractionIds: this.attractions().map(a => a.identifier),
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

  trackByIndex(index: number): number { return index; }
}
