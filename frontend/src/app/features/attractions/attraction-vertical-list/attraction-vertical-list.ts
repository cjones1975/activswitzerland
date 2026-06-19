import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { of, startWith, switchMap, tap, map } from 'rxjs';
import { SkeletonModule } from 'primeng/skeleton';
import { AttractionsService } from '../../../shared/services/attractions';
import { AttractionMarkersService, hasValidGeo } from '../../../shared/services/attraction-markers';
import { Drawer } from '../../../shared/services/drawer';
import { LangService } from '../../../shared/services/lang';
import { Attraction } from '../../../models/attraction';
import { Destination } from '../../../models/destination';

@Component({
  selector: 'app-attraction-vertical-list',
  standalone: true,
  imports: [TranslatePipe, SkeletonModule],
  templateUrl: './attraction-vertical-list.html',
  styleUrl: './attraction-vertical-list.css',
})
export class AttractionVerticalList implements OnInit {
  @Input() destinationId!: string;

  private attractionsService = inject(AttractionsService);
  private attractionMarkers = inject(AttractionMarkersService);
  private drawerSvc = inject(Drawer);
  private translate = inject(TranslateService);
  private langSvc = inject(LangService);
  private destroyRef = inject(DestroyRef);

  attractions: Attraction[] = [];
  loading = signal(true);
  isTop = signal(true);
  skeletons = Array(6);

  ngOnInit(): void {
    this.translate.onLangChange.pipe(
      startWith({ lang: this.langSvc.current }),
      tap(() => this.loading.set(true)),
      switchMap(event => {
        const base = {
          language: event.lang,
          page: 0,
          placeId: this.destinationId,
          expand: false,
          translate: true,
          stripHtml: false,
        };
        return this.attractionsService.getTopAttractions({ ...base, hitsPerPage: 50, top: true }).pipe(
          switchMap(hits => hits.length > 0
            ? of({ attractions: hits, isTop: true })
            : this.attractionsService.getTopAttractions({ ...base, hitsPerPage: 3, top: false }).pipe(
                map(hits => ({ attractions: hits, isTop: false }))
              )
          )
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(({ attractions, isTop }) => {
      this.attractions = attractions;
      this.isTop.set(isTop);
      const geoAttractions = attractions.filter(hasValidGeo);
      this.attractionMarkers.set(
        geoAttractions.map((a: Attraction) => ({
          id: a.identifier,
          lng: Number(a.geo.longitude),
          lat: Number(a.geo.latitude),
          label: a.name,
          icon: 'fa-solid fa-location-dot',
          color: '#1a2f4a',
          clickable: true,
        })),
        geoAttractions
      );
      this.loading.set(false);
    });
  }

  onSeeAll(): void {
    const dest = this.drawerSvc.getPayload<Destination>('destination-detail');
    this.drawerSvc.close('destination-detail');
    this.drawerSvc.open('all-attractions', dest);
  }

  onAttractionClick(attraction: Attraction): void {
    this.attractionMarkers.setSelected(attraction.identifier);
    this.drawerSvc.close('destination-detail');
  }
}
