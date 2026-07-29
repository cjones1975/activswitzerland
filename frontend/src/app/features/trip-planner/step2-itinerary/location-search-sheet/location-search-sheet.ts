import { AfterViewInit, Component, DestroyRef, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild, inject, signal } from '@angular/core';
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
export class LocationSearchSheet implements OnInit, AfterViewInit {
  private transportSvc = inject(TransportService);
  private destroyRef = inject(DestroyRef);

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
