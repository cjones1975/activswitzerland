import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { SkeletonModule } from 'primeng/skeleton';
import { DestinationsService } from '../../../shared/services/destinations';
import { LangService } from '../../../shared/services/lang';
import { Destination } from '../../../models/destination';

@Component({
  selector: 'app-destination-search-results',
  standalone: true,
  imports: [TranslatePipe, SkeletonModule],
  templateUrl: './destination-search-results.html',
  styleUrl: './destination-search-results.css',
})
export class DestinationSearchResults implements OnChanges {
  @Input({ required: true }) query = '';

  private destinationsService = inject(DestinationsService);
  private langSvc = inject(LangService);
  private router = inject(Router);

  results = signal<Destination[]>([]);
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
    this.destinationsService.searchDestinations({
      language: this.langSvc.current,
      page: 0,
      search: this.query,
      hitsPerPage: 50,
    }).subscribe({
      next: results => {
        this.results.set(results);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  onResultClick(dest: Destination): void {
    this.router.navigate(['/destinations', dest.identifier], {
      queryParams: { from: 'search', q: this.query, tab: 'places' },
    });
  }
}
