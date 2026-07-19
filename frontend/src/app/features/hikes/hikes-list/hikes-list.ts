import { Component, DestroyRef, OnDestroy, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { SelectButton } from 'primeng/selectbutton';
import { Select } from 'primeng/select';
import { Message } from 'primeng/message';
import { LangService } from '../../../shared/services/lang';
import { Drawer } from '../../../shared/services/drawer';
import { TrailRoutesService } from '../../../shared/services/trail-routes';
import { HikeMarkersService, TrailCategoryFilter } from '../../../shared/services/hike-markers';
import { TripPlannerService } from '../../../shared/services/trip-planner';
import { TrailThumbnail } from '../../../shared/trail-thumbnail/trail-thumbnail';
import { TrailRoute } from '../../../models/trail-route';
import { GeoLocation, ActivityPickerPayload } from '../../../models/geo-point';
import { locLat, locLon } from '../../../shared/utils/geo-location';
import { stopDayOptions, dayChoiceLabelParams } from '../../../shared/utils/date-range';
import { HikeDetailPayload } from '../hike-detail/hike-detail';

@Component({
  selector: 'app-hikes-list',
  standalone: true,
  imports: [DecimalPipe, FormsModule, SkeletonModule, SelectButton, Select, Message, TranslatePipe, TrailThumbnail],
  templateUrl: './hikes-list.html',
  styleUrl: './hikes-list.css',
})
export class HikesList implements OnDestroy {
  private drawerSvc = inject(Drawer);
  private trailRoutesService = inject(TrailRoutesService);
  // Protected: filter state (radiusKm/selectedCategory) lives on this service,
  // not this component, so it survives the drawer destroying/recreating this
  // component on open/close — see hike-markers.ts for why.
  protected hikeMarkers = inject(HikeMarkersService);
  private plannerSvc = inject(TripPlannerService);
  private translate = inject(TranslateService);
  private langSvc = inject(LangService);
  private destroyRef = inject(DestroyRef);

  private payload = computed(() => {
    this.drawerSvc.list();
    return this.drawerSvc.getPayload<ActivityPickerPayload>('hikes') ?? null;
  });
  destination = computed<GeoLocation | null>(() => this.payload()?.destination ?? null);
  mode = computed(() => this.payload()?.mode ?? 'view');
  stopId = computed(() => this.payload()?.stopId);

  private trip = toSignal(this.plannerSvc.trip$, { initialValue: this.plannerSvc.snapshot });
  dayOptions = computed(() => {
    const stopId = this.stopId();
    return this.mode() === 'select' && stopId ? stopDayOptions(this.trip(), stopId) : [];
  });
  dayChoices = computed(() => this.dayOptions().map(opt => {
    const { key, params } = dayChoiceLabelParams(this.trip(), opt);
    return { value: opt.value, label: this.translate.instant(key, params) };
  }));
  private addedRefIds = computed(() => {
    const stopId = this.stopId();
    if (!stopId) return new Set<string>();
    this.trip();
    return new Set(this.plannerSvc.getActivitiesForStop(stopId).filter(a => a.kind === 'hike').map(a => a.refId));
  });
  private selectedDay = signal<Record<string, string | number>>({});

  radiusOptions = [5, 10, 20, 30];

  categoryOptions: { label: string; value: TrailCategoryFilter }[] = [
    { label: 'hikes.category.all', value: 'all' },
    { label: 'hikes.category.national', value: 'national' },
    { label: 'hikes.category.regional', value: 'regional' },
    { label: 'hikes.category.local', value: 'local' },
  ];

  routes = signal<TrailRoute[]>([]);
  filteredRoutes = computed(() => {
    const category = this.hikeMarkers.selectedCategory();
    return category === 'all' ? this.routes() : this.routes().filter(r => r.category === category);
  });

  loading = signal(false);
  loadError = signal(false);
  skeletons = Array(6);

  seeAllStagesLoading = signal<string | number | null>(null);

  constructor() {
    effect(() => {
      const dest = this.destination();
      if (!dest) return;
      untracked(() => {
        this.hikeMarkers.resetFiltersForDestination(dest);
        this.load();
      });
    });

    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.destination()) this.load();
    });
  }

  private load(): void {
    const dest = this.destination();
    if (!dest) return;

    this.loading.set(true);
    this.loadError.set(false);
    this.trailRoutesService.getRoutes('hike', locLat(dest), locLon(dest), this.langSvc.current, this.hikeMarkers.radiusKm() * 1000).subscribe({
      next: routes => {
        this.routes.set(routes);
        this.hikeMarkers.set(routes);
        this.hikeMarkers.setHasRoutes(routes.length > 0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  onRadiusChange(km: number): void {
    this.hikeMarkers.radiusKm.set(km);
    this.load();
  }

  onRouteClick(route: TrailRoute): void {
    const dest = this.destination();
    if (!dest) return;
    this.hikeMarkers.setSelected(`hike-${route.routeNumber}`);
    if (this.mode() === 'select') {
      const payload: HikeDetailPayload = { route, destination: dest, mode: 'select', stopId: this.stopId() };
      this.drawerSvc.open('hike-detail', payload);
      return;
    }
    const payload: HikeDetailPayload = { route, destination: dest };
    this.drawerSvc.open('hike-detail', payload);
    // Only the detail drawer needs collapsing to reveal the map now — no need
    // to also collapse this list underneath it.
    this.drawerSvc.collapse('hikes');
  }

  stageBadge(route: TrailRoute): string {
    const numbers = route.stages.map(s => s.stageNumber).filter(n => !isNaN(n)).sort((a, b) => a - b);
    const total = route.totalStages;
    if (numbers.length <= 1) {
      return total != null
        ? this.translate.instant('hikes.multiDay.stage', { n: numbers[0], total })
        : this.translate.instant('hikes.multiDay.stageNoTotal', { n: numbers[0] });
    }
    const params = { start: numbers[0], end: numbers[numbers.length - 1] };
    return total != null
      ? this.translate.instant('hikes.multiDay.stageRange', { ...params, total })
      : this.translate.instant('hikes.multiDay.stageRangeNoTotal', params);
  }

  onSeeAllStages(route: TrailRoute): void {
    this.seeAllStagesLoading.set(route.routeNumber);
    this.trailRoutesService.getRouteStages('hike', route.routeNumber, this.langSvc.current).subscribe({
      next: fullRoute => {
        this.seeAllStagesLoading.set(null);
        this.hikeMarkers.setStageOverview(fullRoute);
        this.drawerSvc.collapse('hikes');
      },
      error: () => this.seeAllStagesLoading.set(null),
    });
  }

  isAdded(route: TrailRoute): boolean {
    return this.addedRefIds().has(String(route.routeNumber));
  }

  dayFor(route: TrailRoute): string | number | undefined {
    return this.selectedDay()[route.routeNumber] ?? this.dayOptions()[0]?.value;
  }

  setDay(route: TrailRoute, day: string | number): void {
    this.selectedDay.update(m => ({ ...m, [route.routeNumber]: day }));
  }

  toggleAdd(route: TrailRoute): void {
    const stopId = this.stopId();
    if (!stopId) return;

    const refId = String(route.routeNumber);
    if (this.isAdded(route)) {
      const existing = this.plannerSvc.getActivitiesForStop(stopId).find(a => a.kind === 'hike' && a.refId === refId);
      if (existing) this.plannerSvc.removeActivity(existing.id);
      return;
    }

    const day = this.dayFor(route);
    if (day == null) return;
    const start = route.stages[0]?.geometryWgs84?.coordinates?.[0]?.[0];
    this.plannerSvc.addActivity({
      stopId,
      kind: 'hike',
      refId,
      day,
      name: route.name,
      lat: start?.[1],
      lon: start?.[0],
      distanceKm: route.distanceKm,
      category: route.category,
    });
  }

  ngOnDestroy(): void {
    this.hikeMarkers.clear();
  }
}
