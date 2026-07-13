import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { startWith, switchMap, tap } from 'rxjs';
import { SkeletonModule } from 'primeng/skeleton';
import { DestinationsService } from '../../../shared/services/destinations';
import { LangService } from '../../../shared/services/lang';
import { Destination } from '../../../models/destination';
import { CategoryKey } from '../../../models/destination-category';

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
  @Input() viewAllQueryParams: Record<string, string> = {};
  @Input() categoryKey: CategoryKey | '' = '';

  private destinationsService = inject(DestinationsService);
  private translate = inject(TranslateService);
  private langSvc = inject(LangService);
  private destroyRef = inject(DestroyRef);

  destinations: Destination[] = [];
  loading = signal(true);
  skeletons = Array(6);

  ngOnInit(): void {
    this.translate.onLangChange.pipe(
      startWith({ lang: this.langSvc.current }),
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
