import { Component, DestroyRef, ElementRef, Input, OnInit, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { startWith, switchMap, tap } from 'rxjs';
import { SkeletonModule } from 'primeng/skeleton';
import { DestinationsService } from '../../../shared/services/destinations';
import { Destination } from '../../../models/destination';
import { MapComponent, MapMarker } from '../../../shared/map/map';

@Component({
  selector: 'app-destination-vertical-list',
  standalone: true,
  imports: [TranslatePipe, SkeletonModule, MapComponent, RouterLink],
  templateUrl: './destination-vertical-list.html',
  styleUrl: './destination-vertical-list.css',
})
export class DestinationVerticalList implements OnInit {
  @Input() cardTitle = 'City';
  @Input() title = 'destinations.allCities.title';
  @Input() subTitle = 'destinations.allCities.subtitle';
  @Input() facet = 'placetypes:cities';

  @ViewChild('mapSection') mapSectionRef!: ElementRef<HTMLDivElement>;

  private destinationsService = inject(DestinationsService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  destinations: Destination[] = [];
  loading = signal(true);
  skeletons = Array(6);
  mapMarkers = signal<MapMarker[]>([]);
  activeMarker = signal<{ lng: number; lat: number } | undefined>(undefined);

  ngOnInit(): void {
    this.translate.onLangChange.pipe(
      startWith({ lang: localStorage.getItem('app-lang') || 'en' }),
      tap(() => this.loading.set(true)),
      switchMap(event => this.destinationsService.getDestinations({
        language: event.lang,
        page: 0,
        hitsPerPage: 50,
        facets: this.facet,
        expand: false,
      })),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(hits => {
      this.destinations = hits;
      this.mapMarkers.set(
        hits
          .filter(d => d.geo?.latitude && d.geo?.longitude)
          .map(d => ({ lng: d.geo.longitude, lat: d.geo.latitude, label: d.name }))
      );
      this.loading.set(false);
    });
  }

  selectMarker(lat: number, lng: number): void {
    this.activeMarker.set({ lng, lat });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  formatCoords(lat: number, lng: number): string {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(2)}°${latDir} ${Math.abs(lng).toFixed(2)}°${lngDir}`;
  }
}
