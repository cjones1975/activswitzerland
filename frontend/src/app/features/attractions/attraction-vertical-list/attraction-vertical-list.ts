import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { of, startWith, switchMap, tap, catchError } from 'rxjs';
import { SkeletonModule } from 'primeng/skeleton';
import { Message } from 'primeng/message';
import { AttractionsService } from '../../../shared/services/attractions';
import { AttractionMarkersService, hasValidGeo } from '../../../shared/services/attraction-markers';
import { ActivityMapService } from '../../../shared/services/activity-map';
import { Drawer } from '../../../shared/services/drawer';
import { LangService } from '../../../shared/services/lang';
import { Attraction } from '../../../models/attraction';
import { Destination } from '../../../models/destination';

@Component({
  selector: 'app-attraction-vertical-list',
  standalone: true,
  imports: [TranslatePipe, SkeletonModule, Message],
  templateUrl: './attraction-vertical-list.html',
  styleUrl: './attraction-vertical-list.css',
})
export class AttractionVerticalList implements OnInit {
  @Input() lat!: number;
  @Input() lon!: number;

  private attractionsService = inject(AttractionsService);
  private attractionMarkers = inject(AttractionMarkersService);
  private activityMap = inject(ActivityMapService);
  private drawerSvc = inject(Drawer);
  private translate = inject(TranslateService);
  private langSvc = inject(LangService);
  private destroyRef = inject(DestroyRef);

  private static readonly CARD_LIMIT = 5;

  attractions: Attraction[] = [];
  loading = signal(true);
  loadError = signal(false);
  skeletons = Array(5);

  ngOnInit(): void {
    // Single fetch drives both the card list (first 5) and the map markers
    // (every nearby attraction) - the two used to be separate requests, one
    // via a "top" query, but "top" doesn't combine with the season facet
    // filter on MySwitzerland's side, so there's no curated subset to fetch
    // differently anymore.
    this.translate.onLangChange.pipe(
      startWith({ lang: this.langSvc.current }),
      tap(() => this.loading.set(true)),
      switchMap(event => this.attractionsService.getAttractions({
        language: event.lang,
        page: 0,
        hitsPerPage: 50,
        geoDist: `${this.lat},${this.lon},${this.attractionMarkers.radiusKm() * 1000}`,
      })),
      catchError(() => of(null)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(result => {
      if (!result) {
        this.loading.set(false);
        this.loadError.set(true);
        return;
      }
      this.loadError.set(false);
      this.attractions = result.attractions.slice(0, AttractionVerticalList.CARD_LIMIT);
      this.loading.set(false);

      this.attractionMarkers.setHasAttractions(result.attractions.length > 0);
      const geoAttractions = result.attractions.filter(hasValidGeo);
      this.attractionMarkers.set(
        geoAttractions.map(a => ({ id: a.identifier, lng: Number(a.geo.longitude), lat: Number(a.geo.latitude), label: a.name, image: '/assets/attraction.png', className: 'attraction-marker', clickable: true })),
        geoAttractions
      );
    });
  }

  onSeeAll(): void {
    const dest = this.drawerSvc.getPayload<Destination>('destination-detail');
    this.drawerSvc.close('destination-detail');
    this.activityMap.showOnly('attractions');
    this.drawerSvc.open('all-attractions', { destination: dest, origin: 'destination-detail' });
  }

  onAttractionClick(attraction: Attraction): void {
    this.drawerSvc.close('destination-detail');
    this.activityMap.showOnly('attractions');
    this.attractionMarkers.setSelected(attraction.identifier);
  }
}
