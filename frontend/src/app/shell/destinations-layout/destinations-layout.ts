import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { startWith, switchMap } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DestinationsService } from '../../shared/services/destinations';
import { LangService } from '../../shared/services/lang';
import { Destination } from '../../models/destination';
import { MapComponent } from '../../shared/map/map';
import type { MapMarker } from '../../shared/map/map';
import { Drawer } from '../../shared/services/drawer';
import { AttractionMarkersService } from '../../shared/services/attraction-markers';
import { TripPlannerService } from '../../shared/services/trip-planner';

@Component({
  selector: 'app-destinations-layout',
  standalone: true,
  imports: [MapComponent, TranslatePipe],
  templateUrl: './destinations-layout.html',
  styleUrl: './destinations-layout.css',
})
export class DestinationsLayout implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private destinationsService = inject(DestinationsService);
  private translate = inject(TranslateService);
  private langSvc = inject(LangService);
  protected drawer = inject(Drawer);
  private destroyRef = inject(DestroyRef);
  private attractionMarkers = inject(AttractionMarkersService);
  private tripPlanner = inject(TripPlannerService);

  center = signal<[number, number] | undefined>(undefined);
  destination = signal<Destination | null>(null);

  tripRoute = signal<[number, number][] | null>(null);
  tripType = signal<'road' | 'rail' | null>(null);

  displayMarkers = computed(() => {
    const selectedId = this.attractionMarkers.selectedId();
    return this.attractionMarkers.markers().map(m =>
      selectedId && m.id === selectedId ? { ...m, highlight: true } : m
    );
  });

  selectedMarker = computed(() => {
    const selectedId = this.attractionMarkers.selectedId();
    if (!selectedId) return undefined;
    const m = this.attractionMarkers.markers().find(m => m.id === selectedId);
    return m ? { lng: m.lng, lat: m.lat } : undefined;
  });

  private openDetailTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.tripPlanner.routeCoordinates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(coords => this.tripRoute.set(coords.length ? coords : null));

    this.tripPlanner.trip$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(trip => this.tripType.set(trip.type ?? null));

    this.route.params.pipe(
      switchMap(params =>
        this.translate.onLangChange.pipe(
          startWith({ lang: this.langSvc.current }),
          switchMap(({ lang }) => this.destinationsService.getDestination(params['id'], lang)),
        )
      ),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(dest => {
      this.destination.set(dest);
      if (dest.geo?.latitude && dest.geo?.longitude) {
        this.center.set([dest.geo.longitude, dest.geo.latitude]);
      }
      clearTimeout(this.openDetailTimer);
      this.openDetailTimer = setTimeout(() => this.drawer.open('destination-detail', dest), 100);
    });
  }

  openDetail(): void {
    const dest = this.destination();
    if (dest) this.drawer.open('destination-detail', dest);
  }

  onMarkerClick(marker: MapMarker): void {
    if (!marker.id) return;
    const attraction = this.attractionMarkers.attractionMap().get(marker.id);
    const dest = this.destination();
    if (!attraction || !dest) return;
    if (this.drawer.isOpen('all-attractions') || this.drawer.isCollapsed('all-attractions')) {
      this.drawer.close('all-attractions');
    }
    this.drawer.open('attraction-detail', { attraction, destination: dest, source: 'all-attractions' });
  }

  listAllAttractions(): void {
    const dest = this.destination();
    if (!dest) return;
    this.drawer.close('destination-detail');
    this.drawer.open('all-attractions', dest);
  }

  reopenAllAttractions(): void {
    this.drawer.open('all-attractions');
  }

ngOnDestroy(): void {
    clearTimeout(this.openDetailTimer);
    this.drawer.close('destination-detail');
    this.drawer.close('trip-planner');
    this.attractionMarkers.clear();
    this.tripPlanner.reset();
  }
}
