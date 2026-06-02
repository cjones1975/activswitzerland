import { Component, AfterViewInit, DestroyRef, ElementRef, OnDestroy, ViewChild, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { Drawer } from '../../../shared/services/drawer';
import { AttractionsService } from '../../../shared/services/attractions';
import { AttractionMarkersService, hasValidGeo } from '../../../shared/services/attraction-markers';
import { Attraction } from '../../../models/attraction';
import { Destination } from '../../../models/destination';

@Component({
  selector: 'app-all-attractions',
  standalone: true,
  imports: [SkeletonModule],
  templateUrl: './all-attractions.html',
  styleUrl: './all-attractions.css',
})
export class AllAttractions implements AfterViewInit, OnDestroy {
  @ViewChild('sentinel') sentinelRef!: ElementRef<HTMLDivElement>;

  private drawerSvc = inject(Drawer);
  private attractionsService = inject(AttractionsService);
  private attractionMarkers = inject(AttractionMarkersService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  destination = computed(() => {
    this.drawerSvc.list();
    return this.drawerSvc.getPayload<Destination>('all-attractions') ?? null;
  });

  attractions: Attraction[] = [];
  loading = signal(false);
  hasMore = signal(true);
  skeletons = Array(6);

  private page = 0;
  private totalElements = 0;
  private observer?: IntersectionObserver;
  private lang = localStorage.getItem('app-lang') || 'en';
  private currentDestId: string | null = null;

  constructor() {
    // Reload from scratch whenever the destination changes.
    // The component is never destroyed between drawer opens (PrimeNG keeps it alive),
    // so ngOnInit cannot be relied upon for re-initialisation.
    effect(() => {
      const dest = this.destination();
      if (!dest) { this.currentDestId = null; return; }
      if (dest.identifier === this.currentDestId) return;
      this.currentDestId = dest.identifier;
      untracked(() => this.reset());
    }, { allowSignalWrites: true });
  }

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !this.loading() && this.hasMore()) {
        this.loadMore();
      }
    }, { threshold: 0.1 });
    this.observer.observe(this.sentinelRef.nativeElement);

    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(e => {
      this.lang = e.lang;
      if (this.currentDestId) this.reset();
    });
  }

  private reset(): void {
    this.attractions = [];
    this.page = 0;
    this.totalElements = 0;
    this.hasMore.set(true);
    this.loading.set(false);
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
      placeId: dest.identifier,
    }).subscribe(({ attractions, totalElements }) => {
      this.attractions = [...this.attractions, ...attractions];
      this.totalElements = totalElements;
      this.page++;
      this.hasMore.set(this.attractions.length < this.totalElements);
      this.attractionMarkers.set(
        this.attractions
          .filter(hasValidGeo)
          .map(a => ({ lng: Number(a.geo.longitude), lat: Number(a.geo.latitude), label: a.name, icon: 'fa-solid fa-circle-info', color: '#1a2f4a' }))
      );
      this.loading.set(false);
    });
  }

  onAttractionClick(attraction: Attraction): void {
    const dest = this.destination();
    this.drawerSvc.close('all-attractions');
    this.drawerSvc.open('attraction-detail', { attraction, destination: dest, source: 'all-attractions' });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.attractionMarkers.clear();
  }
}
