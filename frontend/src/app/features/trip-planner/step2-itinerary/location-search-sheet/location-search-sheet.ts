import { AfterViewInit, Component, DestroyRef, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, Renderer2, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, filter, switchMap, tap } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { TransportService, LocationSearchResult } from '../../../../shared/services/transport';

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 300;

@Component({
  selector: 'app-location-search-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './location-search-sheet.html',
  styleUrl: './location-search-sheet.css',
})
export class LocationSearchSheet implements OnInit, AfterViewInit, OnDestroy {
  private transportSvc = inject(TransportService);
  private destroyRef = inject(DestroyRef);
  private hostEl = inject(ElementRef<HTMLElement>);
  private renderer = inject(Renderer2);

  @Input({ required: true }) tripType!: 'road' | 'rail';
  @Input() initialValue = '';
  @Output() selected = new EventEmitter<LocationSearchResult>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('lssInput') private inputRef?: ElementRef<HTMLInputElement>;

  readonly query = signal('');
  readonly results = signal<LocationSearchResult[]>([]);
  readonly loading = signal(false);

  private readonly queryChanges = new Subject<string>();

  ngOnInit(): void {
    // Moved to a direct child of <body> so `.lss-overlay`'s `position: fixed` can never be
    // trapped by an ancestor's stacking context (a scrolled Step 2 card list, wizard chrome,
    // etc.) — the scenario item 2 exists to fix in the first place is opening this while
    // already scrolled down, so it must render correctly regardless of ancestor scroll state.
    this.renderer.appendChild(document.body, this.hostEl.nativeElement);

    this.query.set(this.initialValue);

    this.queryChanges.pipe(
      debounceTime(DEBOUNCE_MS),
      distinctUntilChanged(),
      tap(q => {
        if (q.trim().length < MIN_QUERY_LENGTH) { this.results.set([]); this.loading.set(false); }
        else this.loading.set(true);
      }),
      filter(q => q.trim().length >= MIN_QUERY_LENGTH),
      switchMap(q => this.transportSvc.searchLocations(q, this.tripType)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(results => {
      this.results.set(results);
      this.loading.set(false);
    });
  }

  ngAfterViewInit(): void {
    this.inputRef?.nativeElement.focus();
  }

  ngOnDestroy(): void {
    // Angular's own removal logic tracks the element's original (logical) parent — since it was
    // manually re-parented to <body> above, remove it ourselves so it can't leak into the DOM.
    this.hostEl.nativeElement.remove();
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    this.queryChanges.next(value);
  }

  pick(result: LocationSearchResult): void {
    this.selected.emit(result);
  }

  close(): void {
    this.closed.emit();
  }
}
