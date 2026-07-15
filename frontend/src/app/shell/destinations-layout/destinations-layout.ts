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
import { AttractionDetailPayload } from '../../features/attractions/attraction-detail/attraction-detail';
import { HikeMarkersService } from '../../shared/services/hike-markers';
import { BikeMarkersService } from '../../shared/services/bike-markers';
import { HikeDetailPayload } from '../../features/hikes/hike-detail/hike-detail';
import { BikeDetailPayload } from '../../features/bikes/bike-detail/bike-detail';
import { TrailRoute, trailCategoryColor } from '../../models/trail-route';

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
  protected attractionMarkers = inject(AttractionMarkersService);
  protected hikeMarkers = inject(HikeMarkersService);
  protected bikeMarkers = inject(BikeMarkersService);

  center = signal<[number, number] | undefined>(undefined);
  destination = signal<Destination | null>(null);

  private attractionDetailSource = computed(() => {
    this.drawer.list();
    return this.drawer.getPayload<AttractionDetailPayload>('attraction-detail')?.source;
  });

  private showAttractionMarkers = computed(() => {
    this.drawer.list();
    if (this.drawer.isOpen('all-attractions') || this.drawer.isCollapsed('all-attractions')) return true;
    return this.drawer.isOpen('attraction-detail') && this.attractionDetailSource() === 'all-attractions';
  });

  private showHikeMarkers = computed(() => {
    this.drawer.list();
    return this.drawer.isOpen('hikes') || this.drawer.isCollapsed('hikes')
      || this.drawer.isOpen('hike-detail') || this.drawer.isCollapsed('hike-detail');
  });

  private showBikeMarkers = computed(() => {
    this.drawer.list();
    return this.drawer.isOpen('bikes') || this.drawer.isCollapsed('bikes')
      || this.drawer.isOpen('bike-detail') || this.drawer.isCollapsed('bike-detail');
  });

  // Selected hike/bike route's full geometry, shown as a second map line
  // independent of the trip-planner's own route line. Kept as separate line
  // segments (not joined end-to-end) since a route can have gaps.
  trailRoute = computed<[number, number][][] | null>(() => {
    this.drawer.list();
    if (this.drawer.isOpen('hike-detail') || this.drawer.isCollapsed('hike-detail')) {
      const payload = this.drawer.getPayload<HikeDetailPayload>('hike-detail');
      return payload ? this.collectLines(payload.route.stages) : null;
    }
    if (this.drawer.isOpen('bike-detail') || this.drawer.isCollapsed('bike-detail')) {
      const payload = this.drawer.getPayload<BikeDetailPayload>('bike-detail');
      return payload ? this.collectLines(payload.route.stages) : null;
    }
    return null;
  });

  trailColor = computed<string>(() => {
    this.drawer.list();
    if (this.drawer.isOpen('hike-detail') || this.drawer.isCollapsed('hike-detail')) {
      const payload = this.drawer.getPayload<HikeDetailPayload>('hike-detail');
      return trailCategoryColor(payload?.route.category ?? 'local');
    }
    if (this.drawer.isOpen('bike-detail') || this.drawer.isCollapsed('bike-detail')) {
      const payload = this.drawer.getPayload<BikeDetailPayload>('bike-detail');
      return trailCategoryColor(payload?.route.category ?? 'local');
    }
    return trailCategoryColor('local');
  });

  private collectLines(stages: HikeDetailPayload['route']['stages']): [number, number][][] {
    return stages.flatMap(s => s.geometryWgs84?.coordinates ?? []);
  }

  destinationMarker = computed<MapMarker | null>(() => {
    const dest = this.destination();
    if (!dest?.geo?.latitude || !dest?.geo?.longitude) return null;
    return {
      id: 'destination-marker',
      lng: dest.geo.longitude,
      lat: dest.geo.latitude,
      label: dest.name,
      icon: 'fa-solid fa-location-dot',
      color: '#e53e3e',
      className: 'destination-marker',
    };
  });

  displayMarkers = computed(() => {
    const selectedAttractionId = this.attractionMarkers.selectedId();
    const attractionPins = this.showAttractionMarkers()
      ? this.attractionMarkers.markers().map(m =>
          selectedAttractionId && m.id === selectedAttractionId ? { ...m, highlight: true } : m
        )
      : [];

    const selectedHikeId = this.hikeMarkers.selectedId();
    const hikePins = this.showHikeMarkers()
      ? this.hikeMarkers.markers().map(m =>
          selectedHikeId && m.id === selectedHikeId ? { ...m, highlight: true } : m
        )
      : [];

    const selectedBikeId = this.bikeMarkers.selectedId();
    const bikePins = this.showBikeMarkers()
      ? this.bikeMarkers.markers().map(m =>
          selectedBikeId && m.id === selectedBikeId ? { ...m, highlight: true } : m
        )
      : [];

    const destMarker = this.destinationMarker();
    const pins = [...attractionPins, ...hikePins, ...bikePins];
    return destMarker ? [destMarker, ...pins] : pins;
  });

  selectedMarker = computed(() => {
    const selectedHikeId = this.hikeMarkers.selectedId();
    if (selectedHikeId) {
      const route = this.hikeMarkers.routeMap().get(selectedHikeId);
      const point = route && this.trailFocusPoint(route);
      if (point) return { ...point, zoom: 10 };
    }

    const selectedBikeId = this.bikeMarkers.selectedId();
    if (selectedBikeId) {
      const route = this.bikeMarkers.routeMap().get(selectedBikeId);
      const point = route && this.trailFocusPoint(route);
      if (point) return { ...point, zoom: 10 };
    }

    const selectedId = this.attractionMarkers.selectedId();
    if (!selectedId) return undefined;
    const m = this.attractionMarkers.markers().find(m => m.id === selectedId);
    return m ? { lng: m.lng, lat: m.lat } : undefined;
  });

  // Midpoint between a route's overall start and end coordinates — a
  // reasonable stand-in for "the middle of the trail" given we only have
  // grouped stage geometry, not a guaranteed start-to-end vertex order.
  private trailFocusPoint(route: TrailRoute): { lng: number; lat: number } | undefined {
    const points = route.stages.flatMap(s => s.geometryWgs84?.coordinates ?? []).flat();
    if (!points.length) return undefined;
    const [firstLng, firstLat] = points[0];
    const [lastLng, lastLat] = points[points.length - 1];
    return { lng: (firstLng + lastLng) / 2, lat: (firstLat + lastLat) / 2 };
  }

  private openDetailTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
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
    this.attractionMarkers.setSelected(null);
  }

  onMarkerClick(marker: MapMarker): void {
    if (!marker.id) return;
    const dest = this.destination();
    if (!dest) return;

    if (marker.id.startsWith('hike-')) {
      const route = this.hikeMarkers.routeMap().get(marker.id);
      if (!route) return;
      this.hikeMarkers.setSelected(marker.id);
      this.drawer.open('hike-detail', { route, destination: dest });
      if (this.drawer.isOpen('hikes')) this.drawer.collapse('hikes');
      return;
    }

    if (marker.id.startsWith('bike-')) {
      const route = this.bikeMarkers.routeMap().get(marker.id);
      if (!route) return;
      this.bikeMarkers.setSelected(marker.id);
      this.drawer.open('bike-detail', { route, destination: dest });
      if (this.drawer.isOpen('bikes')) this.drawer.collapse('bikes');
      return;
    }

    const attraction = this.attractionMarkers.attractionMap().get(marker.id);
    if (!attraction) return;
    if (this.drawer.isOpen('all-attractions') || this.drawer.isCollapsed('all-attractions')) {
      this.drawer.close('all-attractions');
    }
    this.drawer.open('attraction-detail', { attraction, destination: dest, source: 'all-attractions' });
  }

  listAllAttractions(): void {
    const dest = this.destination();
    if (!dest) return;
    this.drawer.close('destination-detail');
    this.drawer.open('all-attractions', { destination: dest });
  }

  reopenAllAttractions(): void {
    this.drawer.open('all-attractions');
    this.attractionMarkers.setSelected(null);
  }

  reopenHikes(): void {
    this.drawer.open('hikes');
    this.hikeMarkers.setSelected(null);
  }

  reopenHikeDetail(): void {
    this.drawer.open('hike-detail');
  }

  reopenBikes(): void {
    this.drawer.open('bikes');
    this.bikeMarkers.setSelected(null);
  }

  reopenBikeDetail(): void {
    this.drawer.open('bike-detail');
  }

ngOnDestroy(): void {
    clearTimeout(this.openDetailTimer);
    this.drawer.close('destination-detail');
    this.attractionMarkers.clear();
    this.hikeMarkers.clear();
    this.bikeMarkers.clear();
  }
}
