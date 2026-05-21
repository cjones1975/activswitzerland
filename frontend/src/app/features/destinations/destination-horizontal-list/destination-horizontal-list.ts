import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { startWith, switchMap, tap } from 'rxjs';
import { SkeletonModule } from 'primeng/skeleton';
import { DestinationsService } from '../../../shared/services/destinations';
import { Destination } from '../../../models/destination';

@Component({
  selector: 'app-destination-horizontal-list',
  standalone: true,
  imports: [SkeletonModule, TranslatePipe, RouterLink],
  templateUrl: './destination-horizontal-list.html',
  styleUrl: './destination-horizontal-list.css',
})
export class DestinationHorizontalList implements OnInit {
  @Input() cardTitle = '';
  @Input() title = '';
  @Input() subTitle = '';
  @Input() facet = '';
  @Input() viewAllRoute = '';

  private destinationsService = inject(DestinationsService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  destinations: Destination[] = [];
  loading = signal(true);
  skeletons = Array(6);

  ngOnInit(): void {
    this.translate.onLangChange.pipe(
      startWith({ lang: localStorage.getItem('app-lang') || 'en' }),
      tap(() => this.loading.set(true)),
      switchMap(event => this.destinationsService.getDestinations({
        language: event.lang,
        page: 0,
        hitsPerPage: 10,
        facets: this.facet,
        expand: false,
      })),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(hits => {
      this.destinations = hits;
      this.loading.set(false);
    });
  }
}
