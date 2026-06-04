import { Component, AfterViewInit, DestroyRef, ElementRef, OnDestroy, ViewChild, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { LangService } from '../../../shared/services/lang';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { Drawer } from '../../../shared/services/drawer';
import { AttractionsService } from '../../../shared/services/attractions';
import { AttractionMarkersService, hasValidGeo } from '../../../shared/services/attraction-markers';
import { Attraction } from '../../../models/attraction';
import { Destination } from '../../../models/destination';

@Component({
  selector: 'app-all-attractions',
  standalone: true,
  imports: [FormsModule, InputTextModule, SkeletonModule, TranslatePipe],
  templateUrl: './all-attractions.html',
  styleUrl: './all-attractions.css',
})
export class AllAttractions implements AfterViewInit, OnDestroy {
  @ViewChild('sentinel') sentinelRef!: ElementRef<HTMLDivElement>;

  private drawerSvc = inject(Drawer);
  private attractionsService = inject(AttractionsService);
  private attractionMarkers = inject(AttractionMarkersService);
  private translate = inject(TranslateService);
  private langSvc = inject(LangService);
  private destroyRef = inject(DestroyRef);

  destination = computed(() => {
    this.drawerSvc.list();
    return this.drawerSvc.getPayload<Destination>('all-attractions') ?? null;
  });

  attractions: Attraction[] = [];
  loading = signal(false);
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
      if (dest.identifier === this.currentDestId) return;
      this.currentDestId = dest.identifier;
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
      const geoAttractions = this.attractions.filter(hasValidGeo);
      this.attractionMarkers.set(
        geoAttractions.map(a => ({ id: a.identifier, lng: Number(a.geo.longitude), lat: Number(a.geo.latitude), label: a.name, icon: 'fa-solid fa-circle-info', color: '#1a2f4a', clickable: true })),
        geoAttractions
      );
      this.loading.set(false);
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
      placeId: dest.identifier,
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
    const dest = this.destination();
    this.drawerSvc.close('all-attractions');
    this.drawerSvc.open('attraction-detail', { attraction, destination: dest, source: 'all-attractions' });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.attractionMarkers.clear();
  }
}
