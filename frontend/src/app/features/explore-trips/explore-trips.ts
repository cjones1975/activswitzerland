import { Component, AfterViewInit, DestroyRef, ElementRef, OnDestroy, OnInit, PLATFORM_ID, ViewChild, computed, effect, inject, signal, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { startWith } from 'rxjs';
import { LangService } from '../../shared/services/lang';
import { SeoService } from '../../shared/services/seo';
import { Drawer } from '../../shared/services/drawer';
import { ExploreTripsService } from '../../shared/services/explore-trips';
import { PublicTrip } from '../../models/trip';
import { ExploreTripsFilters, DEFAULT_EXPLORE_TRIPS_FILTERS } from './explore-trips-filter/explore-trips-filter';
import { TripCard } from './trip-card/trip-card';

const BATCH_SIZE = 50;

@Component({
  selector: 'app-explore-trips',
  standalone: true,
  imports: [TranslatePipe, TripCard],
  templateUrl: './explore-trips.html',
  styleUrl: './explore-trips.css',
})
export class ExploreTrips implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('sentinel') sentinelRef!: ElementRef<HTMLDivElement>;

  private translate = inject(TranslateService);
  private langSvc = inject(LangService);
  private seo = inject(SeoService);
  private destroyRef = inject(DestroyRef);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private tripsSvc = inject(ExploreTripsService);
  drawerSvc = inject(Drawer);

  trips = signal<PublicTrip[]>([]);
  loading = signal(false);
  hasMore = signal(true);
  private skip = 0;
  private observer?: IntersectionObserver;

  // `drawerSvc.list()` is read purely to make this computed re-evaluate whenever any drawer's
  // stack changes (the only reactive signal `Drawer` exposes) — but it still only *emits* a new
  // value to the effect below when the actual filter payload reference changes (Angular's default
  // computed equality), so an unrelated drawer opening/closing elsewhere doesn't spuriously
  // refetch this page. See DEFAULT_EXPLORE_TRIPS_FILTERS' comment for why reference stability
  // matters here.
  filters = computed<ExploreTripsFilters>(() => {
    this.drawerSvc.list();
    return this.drawerSvc.getPayload<ExploreTripsFilters>('explore-trips-filter') ?? DEFAULT_EXPLORE_TRIPS_FILTERS;
  });

  constructor() {
    effect(() => {
      this.filters();
      untracked(() => this.reset());
    });
  }

  ngOnInit(): void {
    this.translate.onLangChange.pipe(
      startWith({ lang: this.langSvc.current }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.seo.set({
        title: this.translate.instant('seo.exploreTrips.title'),
        description: this.translate.instant('seo.exploreTrips.description'),
      });
    });
  }

  ngAfterViewInit(): void {
    // IntersectionObserver doesn't exist under Node SSR/prerendering — same guard as
    // all-attractions.ts's identical pattern.
    if (this.isBrowser) {
      this.observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && !this.loading() && this.hasMore()) {
          this.loadMore();
        }
      }, { threshold: 0.1 });
      this.observer.observe(this.sentinelRef.nativeElement);
    }
  }

  openFilterDrawer(): void {
    this.drawerSvc.open('explore-trips-filter', this.filters());
  }

  private reset(): void {
    this.trips.set([]);
    this.skip = 0;
    this.hasMore.set(true);
    this.loadMore();
  }

  private loadMore(): void {
    if (this.loading() || !this.hasMore()) return;
    this.loading.set(true);

    const f = this.filters();
    this.tripsSvc.getPublicTrips({
      skip: this.skip,
      limit: BATCH_SIZE,
      type: f.type,
      sort: f.sortByLikes ? 'likes' : 'createdAt',
      order: f.order,
      minDistance: f.minDistance,
      maxDistance: f.maxDistance,
      reviewLang: f.reviewLang,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ trips, hasMore }) => {
        this.trips.set([...this.trips(), ...trips]);
        this.skip += trips.length;
        this.hasMore.set(hasMore);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.hasMore.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
