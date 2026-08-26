import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output, PLATFORM_ID, ViewChild, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
export class SearchBox implements OnInit, AfterViewInit {
  @Input() initialQuery = '';
  @Input() initialTab: SearchTab = 'places';
  @Output() search = new EventEmitter<{ query: string; tab: SearchTab }>();

  @ViewChild('tabsEl') private tabsEl?: ElementRef<HTMLDivElement>;
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  activeTab = signal<SearchTab>('places');
  queryText = signal('');

  // Tabs overflow horizontally on mobile with no native scrollbar (hidden via CSS) — these
  // drive a fade indicator on whichever edge(s) still have hidden tabs, since nothing else
  // hints to the user that the row scrolls.
  canScrollLeft = signal(false);
  canScrollRight = signal(false);

  placeholderKey = computed(() => PLACEHOLDER_KEYS[this.activeTab()]);

  ngOnInit(): void {
    this.activeTab.set(this.initialTab);
    this.queryText.set(this.initialQuery);
  }

  ngAfterViewInit(): void {
    this.updateScrollFade();
    if (!this.isBrowser) return;
    // ngAfterViewInit can fire before the browser has actually laid out/painted this view (both
    // scrollWidth/clientWidth still read 0), and separately Font Awesome's icon webfont can still
    // be swapping in, changing tab widths after that. Re-measure after a real paint (double rAF)
    // and again once fonts settle — otherwise the initial fade can wrongly read "no overflow",
    // the same stale-measurement class of bug found in PrimeNG's own scrollable-tabs nav buttons
    // on /search.
    requestAnimationFrame(() => requestAnimationFrame(() => this.updateScrollFade()));
    document.fonts?.ready?.then(() => this.updateScrollFade());
  }

  onTabsScroll(): void {
    this.updateScrollFade();
  }

  scrollTabs(direction: -1 | 1): void {
    this.tabsEl?.nativeElement.scrollBy({ left: direction * 150, behavior: 'smooth' });
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateScrollFade();
  }

  private updateScrollFade(): void {
    const el = this.tabsEl?.nativeElement;
    if (!el) return;
    this.canScrollLeft.set(el.scrollLeft > 2);
    this.canScrollRight.set(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
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
