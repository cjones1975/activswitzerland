import { Component, AfterViewInit, DestroyRef, ElementRef, OnDestroy, ViewChild, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, switchMap, map, catchError, of } from 'rxjs';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { Checkbox } from 'primeng/checkbox';
import { Tag } from 'primeng/tag';
import { Button } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { InputTextModule } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Drawer } from '../../../shared/services/drawer';
import { AttractionsService } from '../../../shared/services/attractions';
import { TripPlannerService } from '../../../shared/services/trip-planner';
import { LangService } from '../../../shared/services/lang';
import { Attraction } from '../../../models/attraction';
import { TripStop } from '../../../models/trip';

@Component({
  selector: 'app-things-to-do',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, Checkbox, Tag, Button, Skeleton, InputTextModule, Message],
  templateUrl: './things-to-do.html',
  styleUrl: './things-to-do.css',
})
export class ThingsToDo implements AfterViewInit, OnDestroy {
  @ViewChild('sentinel') sentinelRef!: ElementRef<HTMLDivElement>;

  private drawerSvc = inject(Drawer);
  private attractionsSvc = inject(AttractionsService);
  private plannerSvc = inject(TripPlannerService);
  private langSvc = inject(LangService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  stop = computed(() => {
    this.drawerSvc.list();
    return this.drawerSvc.getPayload<{ stop: TripStop }>('things-to-do')?.stop ?? null;
  });

  attractions = signal<Attraction[]>([]);
  loading = signal(false);
  loadError = signal(false);
  hasMore = signal(true);
  expandedId = signal<string | null>(null);
  skeletons = Array(4);

  searchQuery = '';
  isSearchMode = signal(false);
  searching = signal(false);
  searchResults = signal<Attraction[]>([]);
  noResults = signal(false);

  private page = 0;
  private totalElements = 0;
  private observer?: IntersectionObserver;
  private lang = this.langSvc.current;

  private fetchTrigger$ = new Subject<{ stop: TripStop; lang: string }>();

  constructor() {
    this.fetchTrigger$.pipe(
      switchMap(({ stop, lang }) =>
        this.attractionsSvc.getAttractionsNearby(stop.lat, stop.lon, lang, 0).pipe(
          map(result => ({ stop, result })),
          catchError(() => of(null)),
        )
      ),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(data => {
      if (!data) {
        this.loading.set(false);
        this.loadError.set(true);
        return;
      }
      const { stop, result } = data;
      this.loadError.set(false);
      this.attractions.set(result.attractions);
      this.totalElements = result.totalElements;
      this.page = 1;
      this.hasMore.set(result.attractions.length < result.totalElements);
      this.loading.set(false);
      this.plannerSvc.cacheAttractions(result.attractions);
      this.plannerSvc.hydrateSelections(stop.stationId, result.attractions.map(a => a.identifier));
    });

    effect(() => {
      const stop = this.stop();
      const lang = this.langSvc.current;
      this.expandedId.set(null);
      if (!stop) { this.attractions.set([]); return; }
      untracked(() => {
        this.clearSearch();
        this.reset(stop, lang);
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
      const stop = this.stop();
      if (stop) {
        this.clearSearch();
        this.reset(stop, e.lang);
      }
    });
  }

  private reset(stop: TripStop, lang: string): void {
    this.lang = lang;
    this.attractions.set([]);
    this.page = 0;
    this.totalElements = 0;
    this.hasMore.set(true);
    this.loadError.set(false);
    this.loading.set(true);
    this.fetchTrigger$.next({ stop, lang });
  }

  private loadMore(): void {
    const stop = this.stop();
    if (!stop || this.loading()) return;

    this.loading.set(true);
    this.attractionsSvc.getAttractionsNearby(stop.lat, stop.lon, this.lang, this.page).subscribe(({ attractions, totalElements }) => {
      this.attractions.set([...this.attractions(), ...attractions]);
      this.totalElements = totalElements;
      this.page++;
      this.hasMore.set(this.attractions().length < this.totalElements);
      this.loading.set(false);
      this.plannerSvc.cacheAttractions(attractions);
      this.plannerSvc.hydrateSelections(stop.stationId, attractions.map(a => a.identifier));
    });
  }

  onSearch(): void {
    const query = this.searchQuery.trim().toLowerCase();
    const stop = this.stop();
    if (!query || !stop) return;

    this.isSearchMode.set(true);
    this.noResults.set(false);
    this.searchResults.set([]);

    const local = this.attractions().filter(a =>
      a.name?.toLowerCase().includes(query) || a.abstract?.toLowerCase().includes(query)
    );

    if (local.length > 0) {
      this.searchResults.set(local);
      return;
    }

    this.searching.set(true);
    this.attractionsSvc.searchAttractionsNearby(stop.lat, stop.lon, this.lang, this.searchQuery.trim()).subscribe({
      next: ({ attractions }) => {
        if (attractions.length > 0) {
          this.searchResults.set(attractions);
          this.plannerSvc.cacheAttractions(attractions);
        } else {
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
    this.searchResults.set([]);
    this.noResults.set(false);
    this.searching.set(false);
  }

  isSelected(attractionId: string): boolean {
    const stop = this.stop();
    return !!stop && this.plannerSvc.getSelections(stop.stationId).includes(attractionId);
  }

  toggle(attractionId: string): void {
    const stop = this.stop();
    if (!stop) return;
    this.plannerSvc.toggleAttraction(stop.stationId, attractionId);
  }

  toggleExpand(attractionId: string): void {
    this.expandedId.set(this.expandedId() === attractionId ? null : attractionId);
  }

  categoryTag(attraction: Attraction): string | null {
    return attraction.classification?.[0]?.values?.[0]?.title ?? null;
  }

  viewDetails(attraction: Attraction): void {
    const stop = this.stop();
    if (!stop) return;
    this.drawerSvc.open('attraction-detail', { attraction, stop, source: 'things-to-do' });
  }

  close(): void {
    this.drawerSvc.close('things-to-do');
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
