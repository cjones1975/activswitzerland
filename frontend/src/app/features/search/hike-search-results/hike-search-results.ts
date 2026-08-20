import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { TrailRoutesService } from '../../../shared/services/trail-routes';
import { LangService } from '../../../shared/services/lang';
import { Drawer } from '../../../shared/services/drawer';
import { TrailThumbnail } from '../../../shared/trail-thumbnail/trail-thumbnail';
import { TrailRoute } from '../../../models/trail-route';
import { formatDistanceKmMi } from '../../../shared/utils/distance';
import { HikeDetailPayload } from '../../hikes/hike-detail/hike-detail';

@Component({
  selector: 'app-hike-search-results',
  standalone: true,
  imports: [TranslatePipe, SkeletonModule, TrailThumbnail],
  templateUrl: './hike-search-results.html',
  styleUrl: './hike-search-results.css',
})
export class HikeSearchResults implements OnChanges {
  readonly formatDistanceKmMi = formatDistanceKmMi;

  @Input({ required: true }) query = '';

  private trailRoutesService = inject(TrailRoutesService);
  private langSvc = inject(LangService);
  private drawerSvc = inject(Drawer);
  private translate = inject(TranslateService);

  results = signal<TrailRoute[]>([]);
  loading = signal(false);
  error = signal(false);
  searched = signal(false);
  skeletons = Array(4);

  private lastQuery = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['query'] && this.query && this.query !== this.lastQuery) {
      this.fetch();
    }
  }

  private fetch(): void {
    this.lastQuery = this.query;
    this.loading.set(true);
    this.error.set(false);
    this.searched.set(true);
    this.trailRoutesService.searchRoutes('hike', this.query, this.langSvc.current).subscribe({
      next: routes => {
        this.results.set(routes);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  // Mirrors HikesList.stageBadge() (hikes-list.ts) — kept in sync manually rather
  // than shared, since these are the only two call sites and both are simple.
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

  onResultClick(route: TrailRoute): void {
    const payload: HikeDetailPayload = { route, source: 'search', searchQuery: this.query, searchTab: 'hikes' };
    this.drawerSvc.open('hike-detail', payload);
  }
}
