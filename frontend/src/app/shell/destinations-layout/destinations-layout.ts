import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { catchError, of, startWith, switchMap, tap } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DestinationsService } from '../../shared/services/destinations';
import { LangService } from '../../shared/services/lang';
import { Destination } from '../../models/destination';
import { MapComponent } from '../../shared/map/map';
import type { MapMarker } from '../../shared/map/map';
import { Drawer } from '../../shared/services/drawer';
import { Breakpoint } from '../../shared/services/breakpoint';
import { AttractionMarkersService } from '../../shared/services/attraction-markers';
import { ActivityMapService } from '../../shared/services/activity-map';
import { HikeMarkersService } from '../../shared/services/hike-markers';
import { BikeMarkersService } from '../../shared/services/bike-markers';
import { TrailRoute, trailCategoryColor } from '../../models/trail-route';
import { ActivityPickerPayload } from '../../models/geo-point';
import { formatDistanceKmMi } from '../../shared/utils/distance';
import { SeoService } from '../../shared/services/seo';
import { Toast } from '../../core/services/toast';

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
  protected breakpoint = inject(Breakpoint);
  private destroyRef = inject(DestroyRef);
  protected attractionMarkers = inject(AttractionMarkersService);
  protected hikeMarkers = inject(HikeMarkersService);
  protected bikeMarkers = inject(BikeMarkersService);
  private activityMap = inject(ActivityMapService);
  private seo = inject(SeoService);
  private toast = inject(Toast);

  center = signal<[number, number] | undefined>(undefined);
  destination = signal<Destination | null>(null);

  // Desktop split-view (Phase 0/1 of the desktop responsive redesign): every drawer destinations-layout
  // can host docks non-modally beside the map at >=1280px instead of overlaying it (drawer-host.ts
  // drives each panel itself via the same Breakpoint signal) — this computed shifts the map's own
  // left inset to match, so the map visibly makes room for whichever one is open instead of just
  // sitting underneath it. These keys are mutually exclusive in practice (each flow closes/collapses
  // the previous drawer before opening the next — see e.g. listAllAttractions()/onMarkerClick()
  // below), so at most one of these is ever open at a time.
  sidebarDocked = computed(() => {
    if (!this.breakpoint.isDesktopSplitView()) return false;
    return this.drawer.isOpen('destination-detail')
      || this.drawer.isOpen('all-attractions')
      || this.drawer.isOpen('attraction-detail')
      || this.drawer.isOpen('weather')
      || this.drawer.isOpen('hikes')
      || this.drawer.isOpen('hike-detail')
      || this.drawer.isOpen('bikes')
      || this.drawer.isOpen('bike-detail')
      || this.drawer.isOpen('hotels');
  });

  // Attraction markers are populated as soon as the destination page loads
  // (attraction-vertical-list's all-attractions fetch) and shown unconditionally
  // from then on — no drawer/selection gating needed. ActivityMapService wipes
  // this array when another category (hikes/bikes) becomes active.
  private showAttractionMarkers = computed(() => this.attractionMarkers.markers().length > 0);

  // Nearby-search markers are hidden while a "see all stages" overview is
  // active, so the two never render on the map at once (mirrors the
  // category-level "only one active category" rule from ActivityMapService,
  // scoped here to hikes/bikes' own overview-vs-nearby-search distinction).
  private showHikeMarkers = computed(() => {
    this.drawer.list();
    if (this.hikeMarkers.stageOverview()) return false;
    return this.drawer.isOpen('hikes') || this.drawer.isCollapsed('hikes')
      || this.drawer.isOpen('hike-detail') || this.drawer.isCollapsed('hike-detail');
  });

  private showBikeMarkers = computed(() => {
    this.drawer.list();
    if (this.bikeMarkers.stageOverview()) return false;
    return this.drawer.isOpen('bikes') || this.drawer.isCollapsed('bikes')
      || this.drawer.isOpen('bike-detail') || this.drawer.isCollapsed('bike-detail');
  });

  // "See all stages" nationwide overview — whichever of hikes/bikes is
  // active (only one at a time in practice, since it's triggered per-card
  // from one list). Rendered as its own map line/markers, independent of
  // trailRoute (which is driven by hike-detail/bike-detail instead).
  stageOverviewRoute = computed<TrailRoute | null>(() => this.hikeMarkers.stageOverview() ?? this.bikeMarkers.stageOverview());

  stageOverviewLines = computed<[number, number][][]>(() => {
    const route = this.stageOverviewRoute();
    return route ? route.stages.flatMap(s => s.geometryWgs84?.coordinates ?? []) : [];
  });

  stageOverviewStages = computed<{ lng: number; lat: number; stageNumber: number }[]>(() => {
    const route = this.stageOverviewRoute();
    if (!route) return [];
    return route.stages
      .map(s => {
        const point = s.geometryWgs84?.coordinates?.[0]?.[0];
        return point ? { lng: point[0], lat: point[1], stageNumber: s.stageNumber } : null;
      })
      .filter((s): s is { lng: number; lat: number; stageNumber: number } => s !== null);
  });

  stageOverviewColor = computed<string>(() => trailCategoryColor(this.stageOverviewRoute()?.category ?? 'local'));

  // Selected hike/bike route's full geometry, shown as a second map line
  // independent of the trip-planner's own route line. Kept as separate line
  // segments (not joined end-to-end) since a route can have gaps. Driven by
  // the selected marker itself (not drawer state) so the line is already
  // visible once a route is selected from the list, before hike-detail/
  // bike-detail is opened — matching what's shown once that drawer is open.
  trailRoute = computed<[number, number][][] | null>(() => {
    const selectedHikeId = this.hikeMarkers.selectedId();
    if (selectedHikeId) {
      const route = this.hikeMarkers.routeMap().get(selectedHikeId);
      return route ? this.collectLines(route.stages) : null;
    }
    const selectedBikeId = this.bikeMarkers.selectedId();
    if (selectedBikeId) {
      const route = this.bikeMarkers.routeMap().get(selectedBikeId);
      return route ? this.collectLines(route.stages) : null;
    }
    return null;
  });

  trailColor = computed<string>(() => {
    const selectedHikeId = this.hikeMarkers.selectedId();
    if (selectedHikeId) {
      const route = this.hikeMarkers.routeMap().get(selectedHikeId);
      return trailCategoryColor(route?.category ?? 'local');
    }
    const selectedBikeId = this.bikeMarkers.selectedId();
    if (selectedBikeId) {
      const route = this.bikeMarkers.routeMap().get(selectedBikeId);
      return trailCategoryColor(route?.category ?? 'local');
    }
    return trailCategoryColor('local');
  });

  private collectLines(stages: TrailRoute['stages']): [number, number][][] {
    return stages.flatMap(s => s.geometryWgs84?.coordinates ?? []);
  }

  // Same route resolution as trailRoute()/trailColor() above, plus the "see all stages"
  // overview — TrailRoute.distanceKm already sums every stage of a multi-day route, so this
  // is correct in both the single-selection and stage-overview cases without extra work.
  distanceLabel = computed<string | null>(() => {
    const stageRoute = this.stageOverviewRoute();
    if (stageRoute) return formatDistanceKmMi(stageRoute.distanceKm);

    const selectedHikeId = this.hikeMarkers.selectedId();
    if (selectedHikeId) {
      const route = this.hikeMarkers.routeMap().get(selectedHikeId);
      if (route) return formatDistanceKmMi(route.distanceKm);
    }
    const selectedBikeId = this.bikeMarkers.selectedId();
    if (selectedBikeId) {
      const route = this.bikeMarkers.routeMap().get(selectedBikeId);
      if (route) return formatDistanceKmMi(route.distanceKm);
    }
    return null;
  });

  // Destination copy comes from MySwitzerland with stripHtml=false (destinations.ts
  // keeps markup for the detail page's own rendering), so a meta description needs
  // its own plain-text pass rather than reusing the raw field directly.
  private truncateDescription(html: string | undefined, maxLength = 160): string {
    const text = (html ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1).trimEnd() + '…';
  }

  destinationMarker = computed<MapMarker | null>(() => {
    const dest = this.destination();
    if (!dest?.geo?.latitude || !dest?.geo?.longitude) return null;
    return {
      id: 'destination-marker',
      lng: dest.geo.longitude,
      lat: dest.geo.latitude,
      label: dest.name,
      image: '/assets/destination.png',
      className: 'destination-marker',
      openByDefault: true,
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
      const m = this.hikeMarkers.markers().find(m => m.id === selectedHikeId);
      return m ? { lng: m.lng, lat: m.lat, id: m.id, zoom: 10 } : undefined;
    }

    const selectedBikeId = this.bikeMarkers.selectedId();
    if (selectedBikeId) {
      const m = this.bikeMarkers.markers().find(m => m.id === selectedBikeId);
      return m ? { lng: m.lng, lat: m.lat, id: m.id, zoom: 10 } : undefined;
    }

    const selectedId = this.attractionMarkers.selectedId();
    if (!selectedId) return undefined;
    const m = this.attractionMarkers.markers().find(m => m.id === selectedId);
    return m ? { lng: m.lng, lat: m.lat, id: m.id } : undefined;
  });

  private openDetailTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.route.params.pipe(
      // A new destination route param means a genuinely new destination —
      // wipe any leftover category state (markers, reopen buttons, and the
      // Drawer's collapsed/open flags, which are app-wide singletons the
      // previous destination's ngOnDestroy never touches) before it loads.
      tap(() => this.activityMap.showOnly(null)),
      switchMap(params =>
        this.translate.onLangChange.pipe(
          startWith({ lang: this.langSvc.current }),
          switchMap(({ lang }) => this.destinationsService.getDestination(params['id'], lang).pipe(
            // Caught here (inside the inner switchMap), not left to reach
            // subscribe's error callback — an uncaught error there would
            // tear down this entire subscription permanently, silently
            // breaking every future route/lang change on this component.
            catchError(() => {
              this.destination.set(null);
              this.drawer.close('destination-detail');
              this.seo.set({
                title: this.translate.instant('destinations.detail.loadError'),
                description: this.translate.instant('destinations.detail.loadError'),
                noindex: true,
              });
              this.toast.error(this.translate.instant('destinations.detail.loadError'));
              return of(null);
            }),
          )),
        )
      ),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(dest => {
      if (!dest) return;
      this.destination.set(dest);
      if (dest.geo?.latitude && dest.geo?.longitude) {
        this.center.set([dest.geo.longitude, dest.geo.latitude]);
      }
      this.seo.set({
        title: dest.name,
        description: this.truncateDescription(dest.description || dest.abstract),
        image: dest.photo,
      });
      clearTimeout(this.openDetailTimer);
      this.openDetailTimer = setTimeout(() => this.drawer.open('destination-detail', dest), 100);
    });
  }

  openDetail(): void {
    const dest = this.destination();
    if (dest) this.drawer.open('destination-detail', dest);
    // Returning to the destination should leave only attraction markers on
    // the map — wipe any hike/bike route/markers left over from browsing them.
    this.activityMap.showOnly('attractions');
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
    const listOrigin = this.drawer.getPayload<ActivityPickerPayload>('all-attractions')?.origin;
    // Only treat this as "opened from the list" when the list drawer is actually
    // open (visible alongside the map on wide screens). A merely-collapsed or
    // closed list means the user is looking at the map, so a marker's tooltip
    // link should be treated as opened from the map instead.
    const wasListOpen = this.drawer.isOpen('all-attractions');
    if (wasListOpen) {
      this.drawer.close('all-attractions');
    }
    this.drawer.open('attraction-detail', {
      attraction,
      destination: dest,
      source: wasListOpen ? 'all-attractions' : 'map',
      listOrigin,
    });
  }

  listAllAttractions(): void {
    const dest = this.destination();
    if (!dest) return;
    this.drawer.close('destination-detail');
    this.drawer.open('all-attractions', { destination: dest, origin: 'map' });
  }

  reopenAllAttractions(): void {
    this.drawer.open('all-attractions');
    this.attractionMarkers.setSelected(null);
  }

  reopenHikes(): void {
    // hike-detail drives its own trailRoute/trailColor independently of the
    // hikes list/stageOverview - if it's left open or collapsed underneath
    // (e.g. the user got here via this reopen button rather than hike-detail's
    // own back arrow), its route line would keep rendering alongside whatever
    // the list shows next. Closing it fully (safe no-op if it isn't open) keeps
    // "back to the list" a clean reset regardless of how the user got here.
    this.drawer.close('hike-detail');
    this.drawer.open('hikes');
    this.hikeMarkers.setSelected(null);
    this.hikeMarkers.clearStageOverview();
  }

  reopenBikes(): void {
    this.drawer.close('bike-detail');
    this.drawer.open('bikes');
    this.bikeMarkers.setSelected(null);
    this.bikeMarkers.clearStageOverview();
  }

ngOnDestroy(): void {
    clearTimeout(this.openDetailTimer);
    // Every drawer this page can open (not just destination-detail) — otherwise navigating away
    // (e.g. the header brand link, which is a plain routerLink with no drawer-aware click handler)
    // while one of these is open leaves it rendered on top of whatever page comes next, since
    // DrawerHost is a single global singleton with no route-awareness of its own.
    this.drawer.close('destination-detail');
    this.drawer.close('all-attractions');
    this.drawer.close('attraction-detail');
    this.drawer.close('weather');
    this.drawer.close('hikes');
    this.drawer.close('hike-detail');
    this.drawer.close('bikes');
    this.drawer.close('bike-detail');
    this.drawer.close('hotels');
    this.attractionMarkers.clear();
    this.hikeMarkers.clear();
    this.bikeMarkers.clear();
  }
}
