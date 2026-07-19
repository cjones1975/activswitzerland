import { Component, AfterViewInit, DestroyRef, ElementRef, OnDestroy, ViewChild, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { LangService } from '../../../shared/services/lang';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { Select } from 'primeng/select';
import { SelectButton } from 'primeng/selectbutton';
import { Message } from 'primeng/message';
import { Drawer } from '../../../shared/services/drawer';
import { AttractionsService } from '../../../shared/services/attractions';
import { AttractionMarkersService, hasValidGeo } from '../../../shared/services/attraction-markers';
import { TripPlannerService } from '../../../shared/services/trip-planner';
import { Attraction } from '../../../models/attraction';
import { GeoLocation, ActivityPickerPayload } from '../../../models/geo-point';
import { locId, locLat, locLon } from '../../../shared/utils/geo-location';
import { stopDayOptions, dayChoiceLabelParams } from '../../../shared/utils/date-range';

@Component({
  selector: 'app-all-attractions',
  standalone: true,
  imports: [FormsModule, InputTextModule, SkeletonModule, Select, SelectButton, TranslatePipe, Message],
  templateUrl: './all-attractions.html',
  styleUrl: './all-attractions.css',
})
export class AllAttractions implements AfterViewInit, OnDestroy {
  @ViewChild('sentinel') sentinelRef!: ElementRef<HTMLDivElement>;

  private drawerSvc = inject(Drawer);
  private attractionsService = inject(AttractionsService);
  protected attractionMarkers = inject(AttractionMarkersService);
  private plannerSvc = inject(TripPlannerService);
  private translate = inject(TranslateService);
  private langSvc = inject(LangService);
  private destroyRef = inject(DestroyRef);

  radiusOptions = [5, 10, 20, 30];

  private payload = computed(() => {
    this.drawerSvc.list();
    return this.drawerSvc.getPayload<ActivityPickerPayload>('all-attractions') ?? null;
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
    return new Set(this.plannerSvc.getActivitiesForStop(stopId).filter(a => a.kind === 'attraction').map(a => a.refId));
  });
  private selectedDay = signal<Record<string, string | number>>({});

  attractions: Attraction[] = [];
  loading = signal(false);
  loadError = signal(false);
  hasMore = signal(true);
  skeletons = Array(6);

  searchQuery = '';
  isSearchMode = signal(false);
  searching = signal(false);
  searchResults: Attraction[] = [];
  noResults = signal(false);

  private page = 0;
  private totalElements = 0;
  private observer?: IntersectionObserver;
  private lang = this.langSvc.current;
  private currentDestId: string | null = null;

  constructor() {
    effect(() => {
      const dest = this.destination();
      if (!dest) { this.currentDestId = null; return; }
      const id = locId(dest);
      if (id === this.currentDestId) return;
      this.currentDestId = id;
      untracked(() => {
        this.clearSearch();
        this.reset();
      });
    });
  }

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !this.loading() && this.hasMore() && !this.isSearchMode()) {
        this.loadMore();
      }
    }, { threshold: 0.1 });
    this.observer.observe(this.sentinelRef.nativeElement);

    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(e => {
      this.lang = e.lang;
      if (this.currentDestId) {
        this.clearSearch();
        this.reset();
      }
    });
  }

  onRadiusChange(km: number): void {
    this.attractionMarkers.radiusKm.set(km);
    this.clearSearch();
    this.reset();
  }

  private reset(): void {
    this.attractions = [];
    this.page = 0;
    this.totalElements = 0;
    this.hasMore.set(true);
    this.loading.set(false);
    this.loadError.set(false);
    this.loadMore();
  }

  private loadMore(): void {
    const dest = this.destination();
    if (!dest || this.loading()) return;

    this.loading.set(true);
    this.attractionsService.getAttractions({
      language: this.lang,
      page: this.page,
      hitsPerPage: 30,
      geoDist: `${locLat(dest)},${locLon(dest)},${this.attractionMarkers.radiusKm() * 1000}`,
    }).subscribe({
      next: ({ attractions, totalElements }) => {
        this.attractions = [...this.attractions, ...attractions];
        this.totalElements = totalElements;
        this.page++;
        this.hasMore.set(this.attractions.length < this.totalElements);
        const geoAttractions = this.attractions.filter(hasValidGeo);
        this.attractionMarkers.set(
          geoAttractions.map(a => ({ id: a.identifier, lng: Number(a.geo.longitude), lat: Number(a.geo.latitude), label: a.name, image: '/assets/attraction.png', className: 'attraction-marker', clickable: true })),
          geoAttractions
        );
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  onSearch(): void {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) return;

    this.isSearchMode.set(true);
    this.noResults.set(false);
    this.searchResults = [];

    // Step 1: filter existing loaded records
    const local = this.attractions.filter(a =>
      a.name?.toLowerCase().includes(query) || a.abstract?.toLowerCase().includes(query)
    );

    if (local.length > 0) {
      this.searchResults = local;
      return;
    }

    // Step 2: call the API
    const dest = this.destination();
    if (!dest) { this.noResults.set(true); return; }

    this.searching.set(true);
    this.attractionsService.searchAttractions({
      language: this.lang,
      page: 0,
      search: this.searchQuery.trim(),
      hitsPerPage: 50,
      geoDist: `${locLat(dest)},${locLon(dest)},${this.attractionMarkers.radiusKm() * 1000}`,
      expand: false,
      translate: true,
      stripHtml: false,
      top: true,
    }).subscribe({
      next: ({ attractions }) => {
        if (attractions.length > 0) {
          this.searchResults = attractions;
        } else {
          // Step 3: no results found
          this.noResults.set(true);
        }
        this.searching.set(false);
      },
      error: () => {
        this.noResults.set(true);
        this.searching.set(false);
      },
    });
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.isSearchMode.set(false);
    this.searchResults = [];
    this.noResults.set(false);
    this.searching.set(false);
  }

  onAttractionClick(attraction: Attraction): void {
    if (this.mode() === 'select') {
      const dest = this.destination();
      if (!dest) return;
      this.drawerSvc.open('attraction-detail', {
        attraction, destination: dest, source: 'all-attractions', mode: 'select', stopId: this.stopId(),
      });
      return;
    }
    this.attractionMarkers.setSelected(attraction.identifier);
    this.drawerSvc.collapse('all-attractions');
  }

  isAdded(attraction: Attraction): boolean {
    return this.addedRefIds().has(attraction.identifier);
  }

  dayFor(attraction: Attraction): string | number | undefined {
    return this.selectedDay()[attraction.identifier] ?? this.dayOptions()[0]?.value;
  }

  setDay(attraction: Attraction, day: string | number): void {
    this.selectedDay.update(m => ({ ...m, [attraction.identifier]: day }));
  }

  toggleAdd(attraction: Attraction): void {
    const stopId = this.stopId();
    if (!stopId) return;

    if (this.isAdded(attraction)) {
      const existing = this.plannerSvc.getActivitiesForStop(stopId).find(a => a.kind === 'attraction' && a.refId === attraction.identifier);
      if (existing) this.plannerSvc.removeActivity(existing.id);
      return;
    }

    const day = this.dayFor(attraction);
    if (day == null) return;
    this.plannerSvc.addActivity({
      stopId,
      kind: 'attraction',
      refId: attraction.identifier,
      day,
      name: attraction.name,
      lat: attraction.geo?.latitude != null ? Number(attraction.geo.latitude) : undefined,
      lon: attraction.geo?.longitude != null ? Number(attraction.geo.longitude) : undefined,
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.attractionMarkers.clear();
  }
}
