import { Component, EventEmitter, Input, OnInit, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { InputTextModule } from 'primeng/inputtext';

export type SearchTab = 'places' | 'things' | 'hikes' | 'bikes-road' | 'bikes-mountain';

const PLACEHOLDER_KEYS: Record<SearchTab, string> = {
  places: 'home.search.placeholderPlaces',
  things: 'home.search.placeholderThings',
  hikes: 'home.search.placeholderHikes',
  'bikes-road': 'home.search.placeholderBikesRoad',
  'bikes-mountain': 'home.search.placeholderBikesMountain',
};

@Component({
  selector: 'app-search-box',
  standalone: true,
  imports: [FormsModule, InputTextModule, TranslatePipe],
  templateUrl: './search-box.html',
  styleUrl: './search-box.css',
})
export class SearchBox implements OnInit {
  @Input() initialQuery = '';
  @Input() initialTab: SearchTab = 'places';
  @Output() search = new EventEmitter<{ query: string; tab: SearchTab }>();

  activeTab = signal<SearchTab>('places');
  queryText = signal('');

  placeholderKey = computed(() => PLACEHOLDER_KEYS[this.activeTab()]);

  ngOnInit(): void {
    this.activeTab.set(this.initialTab);
    this.queryText.set(this.initialQuery);
  }

  selectTab(tab: SearchTab): void {
    this.activeTab.set(tab);
  }

  onSubmit(): void {
    const query = this.queryText().trim();
    if (!query) return;
    this.search.emit({ query, tab: this.activeTab() });
  }
}
