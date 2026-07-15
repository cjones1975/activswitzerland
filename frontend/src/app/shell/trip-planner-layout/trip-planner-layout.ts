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

  center = signal<[number, number] | undefined>([8.2275, 46.8182]);
  mapZoom = signal(7);
  destination = signal<Destination | null>(null);

  tripRoute = signal<[number, number][] | null>(null);
  tripType = signal<'road' | 'rail' | null>(null);
  trip = signal<PlannedTrip | null>(null);

  /** Activity pins (Phase 2 populates `trip.activities`; always empty this phase, so this renders nothing yet). */
  tripAttractionMarkers = computed<MapMarker[]>(() =>
    (this.trip()?.activities ?? [])
      .filter(a => a.kind === 'attraction' && a.lat != null && a.lon != null)
      .map(a => ({
        lng: a.lon!,
        lat: a.lat!,
        icon: 'fa-solid fa-location-dot',
        color: '#1a2f4a',
        className: 'trip-attraction-marker',
        label: a.name,
        id: a.refId,
        clickable: true,
      }))
  );

  /** Ordered [lon, lat] pairs for each planned stop, passed to the map for marker rendering. */
  tripStopPoints = computed<[number, number][]>(() =>
    this.trip()?.stops.map(s => [s.lon, s.lat] as [number, number]) ?? []
  );

  /** Route shown on the map — hidden while the trip-planner drawer is open (only revealed on Save/View). */
  displayedTripRoute = computed<[number, number][] | null>(() =>
    this.drawer.isOpen('trip-planner') ? null : this.tripRoute()
  );

  /** "Things to do" attraction pins — hidden while the trip-planner drawer is open (only revealed on Save/View). */
  displayedTripAttractionMarkers = computed<MapMarker[]>(() =>
    this.drawer.isOpen('trip-planner') ? [] : this.tripAttractionMarkers()
  );

  /** Stop markers shown on the map — hidden while the trip-planner drawer is open. */
  displayedTripStopPoints = computed<[number, number][]>(() =>
    this.drawer.isOpen('trip-planner') ? [] : this.tripStopPoints()
  );

  /** Full route coordinates when the drawer collapses so the map can fit the entire route, including round trips. */
  tripBounds = computed<[number, number][] | null>(() => {
    const collapsed = !this.drawer.isOpen('trip-planner');
    const route = this.tripRoute();
    if (!collapsed || !route || route.length < 2) return null;
    return route;
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
            this.mapZoom.set(10);
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
        const hasGeo = !!(dest.geo?.latitude && dest.geo?.longitude);
        if (hasGeo) {
          this.mapZoom.set(12);
          this.center.set([dest.geo.longitude, dest.geo.latitude]);
        }
        this.drawer.open('trip-planner', hasGeo
          ? { name: dest.name, lat: dest.geo.latitude, lon: dest.geo.longitude, identifier: dest.identifier }
          : dest.name);
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
