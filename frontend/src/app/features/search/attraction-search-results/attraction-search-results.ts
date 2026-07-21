import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { AttractionsService } from '../../../shared/services/attractions';
import { LangService } from '../../../shared/services/lang';
import { Drawer } from '../../../shared/services/drawer';
import { Attraction } from '../../../models/attraction';
import { AttractionDetailPayload } from '../../attractions/attraction-detail/attraction-detail';

@Component({
  selector: 'app-attraction-search-results',
  standalone: true,
  imports: [TranslatePipe, SkeletonModule],
  templateUrl: './attraction-search-results.html',
  styleUrl: './attraction-search-results.css',
})
export class AttractionSearchResults implements OnChanges {
  @Input({ required: true }) query = '';

  private attractionsService = inject(AttractionsService);
  private langSvc = inject(LangService);
  private drawerSvc = inject(Drawer);

  results = signal<Attraction[]>([]);
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
    this.attractionsService.searchAttractions({
      language: this.langSvc.current,
      page: 0,
      search: this.query,
      hitsPerPage: 50,
      expand: false,
      translate: true,
      stripHtml: false,
      top: false,
    }).subscribe({
      next: page => {
        this.results.set(page.attractions);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  onResultClick(attraction: Attraction): void {
    const payload: AttractionDetailPayload = {
      attraction,
      source: 'search',
      searchQuery: this.query,
      searchTab: 'things',
    };
    this.drawerSvc.open('attraction-detail', payload);
  }
}
