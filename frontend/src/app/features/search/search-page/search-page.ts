import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { InputTextModule } from 'primeng/inputtext';
import { Tabs, TabList, Tab, TabPanels, TabPanel } from 'primeng/tabs';
import { SearchTab } from '../search-box/search-box';
import { DestinationSearchResults } from '../destination-search-results/destination-search-results';
import { AttractionSearchResults } from '../attraction-search-results/attraction-search-results';

@Component({
  selector: 'app-search-page',
  standalone: true,
  imports: [
    FormsModule,
    InputTextModule,
    TranslatePipe,
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    DestinationSearchResults,
    AttractionSearchResults,
  ],
  templateUrl: './search-page.html',
  styleUrl: './search-page.css',
})
export class SearchPage {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  query = signal('');
  activeTab = signal<SearchTab>('places');
  queryInput = signal('');

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const q = params.get('q') ?? '';
      this.query.set(q);
      this.queryInput.set(q);
      this.activeTab.set(params.get('tab') === 'things' ? 'things' : 'places');
    });
  }

  onTabChange(tab: string | number | undefined): void {
    if (tab == null) return;
    this.updateUrl({ tab: tab as SearchTab });
  }

  onSubmit(): void {
    const q = this.queryInput().trim();
    if (!q) return;
    this.updateUrl({ q });
  }

  private updateUrl(params: { q?: string; tab?: SearchTab }): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: params.q ?? this.query(), tab: params.tab ?? this.activeTab() },
      queryParamsHandling: 'merge',
    });
  }
}
