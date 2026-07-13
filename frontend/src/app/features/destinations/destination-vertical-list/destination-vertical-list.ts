import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { combineLatest, startWith, switchMap, tap } from 'rxjs';
import { SkeletonModule } from 'primeng/skeleton';
import { DestinationsService } from '../../../shared/services/destinations';
import { LangService } from '../../../shared/services/lang';
import { Destination } from '../../../models/destination';
import { MapComponent, MapMarker } from '../../../shared/map/map';
import { CategoryConfig, CategoryKey, DESTINATION_CATEGORIES } from '../../../models/destination-category';

@Component({
  selector: 'app-destination-vertical-list',
  standalone: true,
  imports: [TranslatePipe, SkeletonModule, MapComponent, RouterLink],
  templateUrl: './destination-vertical-list.html',
  styleUrl: './destination-vertical-list.css',
})
export class DestinationVerticalList implements OnInit {
  @ViewChild('mapSection') mapSectionRef!: ElementRef<HTMLDivElement>;

  private route = inject(ActivatedRoute);
  private destinationsService = inject(DestinationsService);
  private translate = inject(TranslateService);
  private langSvc = inject(LangService);
  private destroyRef = inject(DestroyRef);

  destinations: Destination[] = [];
  loading = signal(true);
  skeletons = Array(6);
  mapMarkers = signal<MapMarker[]>([]);
  config = signal<CategoryConfig>(DESTINATION_CATEGORIES.cities);
  categoryKey = signal<CategoryKey>('cities');

  ngOnInit(): void {
    combineLatest([
      this.route.queryParamMap,
      this.translate.onLangChange.pipe(startWith({ lang: this.langSvc.current })),
    ]).pipe(
      tap(([params]) => {
        const requested = params.get('category') as CategoryKey | null;
        const resolved: CategoryKey = requested && DESTINATION_CATEGORIES[requested] ? requested : 'cities';
        this.categoryKey.set(resolved);
        this.config.set(DESTINATION_CATEGORIES[resolved]);
        this.loading.set(true);
      }),
      switchMap(([, event]) => this.destinationsService.getDestinations({
        language: event.lang,
        page: 0,
        hitsPerPage: 50,
        facets: this.config().facets,
        expand: false,
      })),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(hits => {
      this.destinations = hits;
      const icon = this.config().mapIcon;
      this.mapMarkers.set(
        hits
          .filter(d => d.geo?.latitude && d.geo?.longitude)
          .map(d => ({ lng: d.geo.longitude, lat: d.geo.latitude, label: d.name, icon }))
      );
      this.loading.set(false);
    });
  }
}
