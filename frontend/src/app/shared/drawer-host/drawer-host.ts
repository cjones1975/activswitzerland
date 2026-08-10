import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Drawer, DrawerKey } from '../services/drawer';
import { AttractionMarkersService } from '../services/attraction-markers';
import { DrawerModule } from 'primeng/drawer';
import { TranslatePipe } from '@ngx-translate/core';

// Drawers
import { MenuNav } from '../../shell/menu-nav/menu-nav';
import { AuthLayout } from '../../features/auth/auth-layout/auth-layout';
import { ForgotPassword } from '../../features/auth/forgot-password/forgot-password';
import { DestinationDetail } from '../../features/destinations/destination-detail/destination-detail';
import { AllAttractions } from '../../features/attractions/all-attractions/all-attractions';
import { AttractionDetail, AttractionDetailPayload } from '../../features/attractions/attraction-detail/attraction-detail';
import { Weather } from '../weather/weather';
import { TripPlannerService } from '../services/trip-planner';
import { ConnectionsDrawer } from '../../features/trip-planner/connections-drawer/connections-drawer';
import { HikesList } from '../../features/hikes/hikes-list/hikes-list';
import { HikeDetail } from '../../features/hikes/hike-detail/hike-detail';
import type { HikeDetailPayload } from '../../features/hikes/hike-detail/hike-detail';
import { BikesList } from '../../features/bikes/bikes-list/bikes-list';
import { BikeDetail } from '../../features/bikes/bike-detail/bike-detail';
import type { BikeDetailPayload } from '../../features/bikes/bike-detail/bike-detail';
import { HotelsStub } from '../../features/hotels/hotels-stub/hotels-stub';
import { ExploreTripsFilter } from '../../features/explore-trips/explore-trips-filter/explore-trips-filter';
import { ActivityPickerPayload } from '../../models/geo-point';
import { WeatherPayload } from '../../models/weather';
import { LangService } from '../services/lang';
import { Breakpoint } from '../services/breakpoint';

@Component({
  selector: 'app-drawer-host',
  standalone: true,
  imports: [CommonModule, DrawerModule, TranslatePipe, MenuNav, AuthLayout, ForgotPassword, DestinationDetail, AllAttractions, AttractionDetail, Weather, ConnectionsDrawer, HikesList, HikeDetail, BikesList, BikeDetail, HotelsStub, ExploreTripsFilter],
  templateUrl: './drawer-host.html',
  styleUrl: './drawer-host.css',
})
export class DrawerHost {
  svc = inject(Drawer);
  protected breakpoint = inject(Breakpoint);
  private router = inject(Router);
  private langSvc = inject(LangService);
  private attractionMarkers = inject(AttractionMarkersService);
  private tripPlanner = inject(TripPlannerService);

  onVisibleChange(key: DrawerKey, visible: boolean) {
    visible ? this.svc.open(key) : this.svc.close(key);
  }

  onDrawerClose(key: DrawerKey) {
    this.svc.close(key);
  }

  onCollapse(key: DrawerKey) {
    this.svc.collapse(key);
  }

  onDestinationBack() {
    this.svc.close('destination-detail');
    const queryParams = this.router.parseUrl(this.router.url).queryParams;
    if (queryParams['from'] === 'search') {
      this.langSvc.navigate(['search'], { queryParams: { q: queryParams['q'], tab: queryParams['tab'] } });
      return;
    }
    const category = queryParams['category'];
    this.langSvc.navigate(['destinations'], category ? { queryParams: { category } } : {});
  }

  onAllAttractionsBack() {
    const payload = this.svc.getPayload<ActivityPickerPayload>('all-attractions');
    if (payload?.mode === 'select') {
      this.svc.close('all-attractions');
      this.tripPlanner.showWizard();
    } else {
      this.svc.collapse('all-attractions');
      if (payload?.origin === 'destination-detail') {
        this.svc.open('destination-detail', payload.destination);
      }
    }
    this.attractionMarkers.setSelected(null);
  }

  allAttractionsDestinationName = computed(() => {
    this.svc.list();
    return this.svc.getPayload<ActivityPickerPayload>('all-attractions')?.destination?.name ?? '';
  });

  // Trip-planner picker flow (opened in 'select' mode, or reached from a
  // trip-summary map marker) shows no "show on map" affordance — the wizard
  // isn't a drawer over this map, it's a different page's content entirely.
  isAllAttractionsTripPlanner = computed(() => {
    this.svc.list();
    return this.svc.getPayload<ActivityPickerPayload>('all-attractions')?.mode === 'select';
  });

  attractionDetailSource = computed(() => {
    this.svc.list();
    return this.svc.getPayload<AttractionDetailPayload>('attraction-detail')?.source;
  });

  // Also covers the 'search' source: /search has no map view behind it, so
  // there's nothing for "show on map" to reveal there either.
  isAttractionDetailTripPlanner = computed(() => {
    this.svc.list();
    const payload = this.svc.getPayload<AttractionDetailPayload>('attraction-detail');
    return payload?.mode === 'select' || payload?.source === 'trip-summary' || payload?.source === 'search';
  });

  onAttractionDetailBack() {
    const payload = this.svc.getPayload<AttractionDetailPayload>('attraction-detail')!;
    this.svc.close('attraction-detail');
    if (payload.source === 'destination-detail') {
      this.svc.open('destination-detail', payload.destination);
      return;
    }
    if (payload.source === 'trip-summary') {
      this.tripPlanner.showWizard();
      return;
    }
    if (payload.source === 'map') {
      return;
    }
    if (payload.source === 'search') {
      this.langSvc.navigate(['search'], { queryParams: { q: payload.searchQuery, tab: payload.searchTab ?? 'things' } });
      return;
    }
    this.svc.open('all-attractions', { destination: payload.destination, mode: payload.mode, stopId: payload.stopId, origin: payload.listOrigin });
  }

  attractionDetailDestinationName = computed(() => {
    this.svc.list();
    return this.svc.getPayload<AttractionDetailPayload>('attraction-detail')?.destination?.name ?? '';
  });

  weatherLocationName = computed(() => {
    this.svc.list();
    return this.svc.getPayload<WeatherPayload>('weather')?.locationName ?? '';
  });

  onWeatherBack() {
    const payload = this.svc.getPayload<WeatherPayload>('weather');
    this.svc.close('weather');
    if (payload?.destination) {
      this.svc.open('destination-detail', payload.destination);
    }
  }

  onHikesBack() {
    const payload = this.svc.getPayload<ActivityPickerPayload>('hikes');
    this.svc.close('hikes');
    if (payload?.mode === 'select') {
      this.tripPlanner.showWizard();
    } else {
      this.svc.open('destination-detail', payload?.destination);
    }
  }

  hikesDestinationName = computed(() => {
    this.svc.list();
    return this.svc.getPayload<ActivityPickerPayload>('hikes')?.destination?.name ?? '';
  });

  isHikesTripPlanner = computed(() => {
    this.svc.list();
    return this.svc.getPayload<ActivityPickerPayload>('hikes')?.mode === 'select';
  });

  isHikeDetailTripPlanner = computed(() => {
    this.svc.list();
    const payload = this.svc.getPayload<HikeDetailPayload>('hike-detail');
    return payload?.mode === 'select' || payload?.source === 'trip-summary';
  });

  onHikeDetailBack() {
    const payload = this.svc.getPayload<HikeDetailPayload>('hike-detail')!;
    this.svc.close('hike-detail');
    if (payload.source === 'trip-summary') {
      this.tripPlanner.showWizard();
      return;
    }
    this.svc.open('hikes', { destination: payload.destination, mode: payload.mode, stopId: payload.stopId });
  }

  onBikesBack() {
    const payload = this.svc.getPayload<ActivityPickerPayload>('bikes');
    this.svc.close('bikes');
    if (payload?.mode === 'select') {
      this.tripPlanner.showWizard();
    } else {
      this.svc.open('destination-detail', payload?.destination);
    }
  }

  bikesDestinationName = computed(() => {
    this.svc.list();
    return this.svc.getPayload<ActivityPickerPayload>('bikes')?.destination?.name ?? '';
  });

  isBikesTripPlanner = computed(() => {
    this.svc.list();
    return this.svc.getPayload<ActivityPickerPayload>('bikes')?.mode === 'select';
  });

  isBikeDetailTripPlanner = computed(() => {
    this.svc.list();
    const payload = this.svc.getPayload<BikeDetailPayload>('bike-detail');
    return payload?.mode === 'select' || payload?.source === 'trip-summary';
  });

  onBikeDetailBack() {
    const payload = this.svc.getPayload<BikeDetailPayload>('bike-detail')!;
    this.svc.close('bike-detail');
    if (payload.source === 'trip-summary') {
      this.tripPlanner.showWizard();
      return;
    }
    this.svc.open('bikes', { destination: payload.destination, mode: payload.mode, stopId: payload.stopId });
  }

  onHotelsBack() {
    const payload = this.svc.getPayload<ActivityPickerPayload>('hotels');
    this.svc.close('hotels');
    if (payload?.mode === 'select') {
      this.tripPlanner.showWizard();
    } else {
      this.svc.open('destination-detail', payload?.destination);
    }
  }

  hotelsDestinationName = computed(() => {
    this.svc.list();
    return this.svc.getPayload<ActivityPickerPayload>('hotels')?.destination?.name ?? '';
  });

  // Dismissing this drawer without hitting Apply/Reset (X button, backdrop tap) must not lose
  // ExploreTrips' currently-applied filters — see Drawer.closePreservingPayload().
  onExploreTripsFilterVisibleChange(visible: boolean): void {
    if (visible) {
      this.svc.open('explore-trips-filter');
      return;
    }
    this.svc.closePreservingPayload('explore-trips-filter');
  }

  /**
   * A `[modal]` binding that only recomputes while `key`'s drawer is actually open, never during
   * its close transition. Needed because `Drawer.close()` deletes the drawer's payload in the same
   * synchronous call that hides it — a naive `[modal]="isXTripPlanner() || ..."` binding (reading
   * that payload reactively) flips to a new value in the very same change-detection cycle that sets
   * `[visible]="false"`. PrimeNG's `p-drawer` only removes its scrim mask via `hide()`'s
   * `if (this.modal) this.disableModality()` — if Angular has already pushed the new (stale-false)
   * `modal` value into the component before that animation-driven `hide()` call reads it, the mask
   * is never removed: left in the DOM, invisible, permanently blocking clicks on whatever renders
   * underneath. Found via live testing: closing a trip-planner Activities picker left the docked
   * wizard behind it unclickable. Holding the value steady while `isOpen(key)` is false sidesteps
   * the race — what it's left at during close doesn't matter, since the drawer is hiding either way.
   */
  private stickyModal(key: DrawerKey, isTripPlannerMode: () => boolean) {
    const modal = signal(true);
    effect(() => {
      if (this.svc.isOpen(key)) {
        modal.set(isTripPlannerMode() || !this.breakpoint.isDesktopSplitView());
      }
    });
    return modal;
  }

  allAttractionsModal = this.stickyModal('all-attractions', () => this.isAllAttractionsTripPlanner());
  attractionDetailModal = this.stickyModal('attraction-detail', () => this.isAttractionDetailTripPlanner());
  hikesModal = this.stickyModal('hikes', () => this.isHikesTripPlanner());
  hikeDetailModal = this.stickyModal('hike-detail', () => this.isHikeDetailTripPlanner());
  bikesModal = this.stickyModal('bikes', () => this.isBikesTripPlanner());
  bikeDetailModal = this.stickyModal('bike-detail', () => this.isBikeDetailTripPlanner());
}
