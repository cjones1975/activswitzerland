import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { of, startWith, switchMap } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DestinationsService } from '../../shared/services/destinations';
import { LangService } from '../../shared/services/lang';
import { Destination } from '../../models/destination';
import { MapComponent } from '../../shared/map/map';
import type { MapMarker } from '../../shared/map/map';
import { Drawer } from '../../shared/services/drawer';
import { TripPlannerService } from '../../shared/services/trip-planner';
import { hasValidGeo } from '../../shared/services/attraction-markers';
import { PlannedTrip } from '../../models/trip';

@Component({
  selector: 'app-trip-planner-layout',
  standalone: true,
  imports: [MapComponent, TranslatePipe],
  templateUrl: './trip-planner-layout.html',
  styleUrl: './trip-planner-layout.css',
})
export class TripPlannerLayout implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destinationsService = inject(DestinationsService);
  private translate = inject(TranslateService);
  private langSvc = inject(LangService);
  protected drawer = inject(Drawer);
  private destroyRef = inject(DestroyRef);
  private tripPlanner = inject(TripPlannerService);

  center = signal<[number, number] | undefined>(undefined);
  destination = signal<Destination | null>(null);

  tripRoute = signal<[number, number][] | null>(null);
  tripType = signal<'road' | 'rail' | null>(null);
  trip = signal<PlannedTrip | null>(null);

  /** Attraction pins for stops' selected "things to do", reactive to selection and cache changes. */
  tripAttractionMarkers = computed<MapMarker[]>(() => {
    const selections = this.trip()?.attractionSelections;
    this.tripPlanner.attractionCacheVersion();
    if (!selections) return [];

    const ids = new Set(Object.values(selections).flat());
    const markers: MapMarker[] = [];
    for (const id of ids) {
      const attraction = this.tripPlanner.getAttraction(id);
      if (attraction && hasValidGeo(attraction)) {
        markers.push({
          lng: attraction.geo.longitude,
          lat: attraction.geo.latitude,
          icon: 'fa-solid fa-map-pin',
          color: '#dc0015',
          className: 'trip-attraction-marker',
          label: attraction.name,
          id: attraction.identifier,
        });
      }
    }
    return markers;
  });

  /** Start/end of the route, recomputed whenever the trip-planner drawer collapses so the map can zoom out to fit them. */
  tripBounds = computed<[number, number][] | null>(() => {
    const collapsed = !this.drawer.isOpen('trip-planner');
    const route = this.tripRoute();
    if (!collapsed || !route || route.length < 2) return null;
    return [route[0], route[route.length - 1]];
  });

  private firstRouteEmission = true;

  ngOnInit(): void {
    this.tripPlanner.routeCoordinates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(coords => {
        this.tripRoute.set(coords.length ? coords : null);

        if (this.firstRouteEmission) {
          this.firstRouteEmission = false;
          if (!this.route.snapshot.paramMap.get('id') && coords.length) {
            const lons = coords.map(c => c[0]);
            const lats = coords.map(c => c[1]);
            this.center.set([
              (Math.min(...lons) + Math.max(...lons)) / 2,
              (Math.min(...lats) + Math.max(...lats)) / 2,
            ]);
          }
        }
      });

    this.tripPlanner.trip$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(trip => {
        this.tripType.set(trip.type ?? null);
        this.trip.set(trip);
      });

    this.route.paramMap.pipe(
      switchMap(params => {
        const id = params.get('id');
        if (!id) return of(null);
        return this.translate.onLangChange.pipe(
          startWith({ lang: this.langSvc.current }),
          switchMap(({ lang }) => this.destinationsService.getDestination(id, lang)),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(dest => {
      this.destination.set(dest);
      if (dest) {
        if (dest.geo?.latitude && dest.geo?.longitude) {
          this.center.set([dest.geo.longitude, dest.geo.latitude]);
        }
        this.drawer.open('trip-planner', dest.name);
      } else {
        this.drawer.open('trip-planner');
      }
    });
  }

  backToDestination(): void {
    const dest = this.destination();
    if (!dest) return;
    this.router.navigate(['/destinations', dest.identifier]);
  }

  reopenTripPlanner(): void {
    this.drawer.open('trip-planner');
  }

  ngOnDestroy(): void {
    this.drawer.close('trip-planner');
    this.tripPlanner.reset();
  }
}
